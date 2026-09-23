/**
 * In-memory composition engine for LocalNet UI demos when no ledger is configured.
 * Mirrors Propose → Accept → Settle / Revert and per-party ACS visibility (R-PRIV).
 */
import { randomUUID } from "node:crypto";

export type PartyId =
  | "Operator"
  | "Alice"
  | "Bob"
  | "Oracle"
  | "Regulator";

export type Token = {
  contractId: string;
  owner: PartyId;
  issuer: PartyId;
  instrumentId: string;
  amount: string;
};

export type LegSpec = {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: PartyId;
  receiver: PartyId;
  assetCid: string;
};

export type CompositionStatus =
  | "proposed"
  | "partially_accepted"
  | "accepted"
  | "settled"
  | "reverted";

export type Composition = {
  id: string;
  proposalCid: string;
  trackerCid: string | null;
  agreementCid: string | null;
  receiptCid: string | null;
  proposer: PartyId;
  counterparties: PartyId[];
  accepted: PartyId[];
  legs: LegSpec[];
  description: string;
  status: CompositionStatus;
  settledAt?: string;
  legSummaries?: { legId: string; instrumentId: string; status: string }[];
  forceFail?: boolean;
};

export type Metrics = {
  compositionsSettled: number;
  compositionsReverted: number;
  legsSettled: number;
  unexpectedFailures: number;
};

const parties: PartyId[] = ["Operator", "Alice", "Bob", "Oracle", "Regulator"];

export class DemoStore {
  tokens = new Map<string, Token>();
  compositions = new Map<string, Composition>();
  metrics: Metrics = {
    compositionsSettled: 0,
    compositionsReverted: 0,
    legsSettled: 0,
    unexpectedFailures: 0,
  };

  constructor() {
    this.seed();
  }

  private seed() {
    this.mint("Alice", "CBTC", "2.0");
    this.mint("Bob", "USDCx", "10000.0");
    this.mint("Oracle", "ATTEST", "1.0");
    this.mint("Alice", "cETH", "5.0");
    this.mint("Bob", "CBTC", "1.0");
  }

  mint(owner: PartyId, instrumentId: string, amount: string): Token {
    const token: Token = {
      contractId: `tok-${randomUUID()}`,
      owner,
      issuer: "Operator",
      instrumentId,
      amount,
    };
    this.tokens.set(token.contractId, token);
    return token;
  }

  listTokens(party: PartyId): Token[] {
    // Per-leg privacy: only owner (and issuer/operator) see token payloads.
    if (party === "Regulator") return [];
    return [...this.tokens.values()].filter(
      (t) => t.owner === party || party === "Operator",
    );
  }

  propose(input: {
    proposer: PartyId;
    counterparties: PartyId[];
    legs: LegSpec[];
    description: string;
    forceFail?: boolean;
  }): Composition {
    if (input.legs.length < 2) throw new Error("at least two legs required");
    for (const leg of input.legs) {
      const tok = this.tokens.get(leg.assetCid);
      if (!tok) throw new Error(`unknown asset ${leg.assetCid}`);
      if (tok.owner !== leg.provider) {
        throw new Error(`asset ${leg.assetCid} not owned by ${leg.provider}`);
      }
    }
    const id = randomUUID();
    const c: Composition = {
      id,
      proposalCid: `prop-${id}`,
      trackerCid: `trk-${id}`,
      agreementCid: null,
      receiptCid: null,
      proposer: input.proposer,
      counterparties: input.counterparties,
      accepted: [],
      legs: input.legs,
      description: input.description,
      status: "proposed",
      forceFail: input.forceFail,
    };
    this.compositions.set(id, c);
    return c;
  }

  accept(compositionId: string, acceptor: PartyId): Composition {
    const c = this.require(compositionId);
    if (!c.counterparties.includes(acceptor)) {
      throw new Error(`${acceptor} is not a counterparty`);
    }
    if (c.accepted.includes(acceptor)) return c;
    c.accepted = [...c.accepted, acceptor];
    const allAccepted = c.counterparties.every((p) => c.accepted.includes(p));
    c.status = allAccepted ? "accepted" : "partially_accepted";
    if (allAccepted) c.agreementCid = `agr-${c.id}`;
    return c;
  }

  settle(compositionId: string, withRegulator = true): Composition {
    const c = this.require(compositionId);
    if (c.status !== "accepted") {
      throw new Error("composition not fully accepted");
    }
    if (c.forceFail) {
      c.status = "reverted";
      this.metrics.compositionsReverted += 1;
      throw new Error("atomic settle reverted: leg Transfer failed");
    }
    for (const leg of c.legs) {
      const tok = this.tokens.get(leg.assetCid);
      if (!tok || tok.owner !== leg.provider) {
        c.status = "reverted";
        this.metrics.compositionsReverted += 1;
        throw new Error(`atomic settle reverted: leg ${leg.legId} failed`);
      }
    }
    // All-or-nothing transfer
    for (const leg of c.legs) {
      const tok = this.tokens.get(leg.assetCid)!;
      tok.owner = leg.receiver;
    }
    c.status = "settled";
    c.settledAt = new Date().toISOString();
    c.receiptCid = `rcpt-${c.id}`;
    c.legSummaries = c.legs.map((l) => ({
      legId: l.legId,
      instrumentId: l.instrumentId,
      status: "LegSettled",
    }));
    this.metrics.compositionsSettled += 1;
    this.metrics.legsSettled += c.legs.length;
    void withRegulator;
    return c;
  }

  partyView(party: PartyId) {
    const tokens = this.listTokens(party);
    const compositions = [...this.compositions.values()].filter((c) => {
      if (party === "Operator" || party === c.proposer) return true;
      if (c.counterparties.includes(party)) return true;
      if (party === "Regulator") return c.status === "settled";
      return false;
    });

    const receipts =
      party === "Regulator" || party === "Operator"
        ? compositions
            .filter((c) => c.status === "settled")
            .map((c) => ({
              receiptCid: c.receiptCid,
              description: c.description,
              settledAt: c.settledAt,
              legSummaries: c.legSummaries,
              // Regulator sees statuses only — never leg asset payloads / cids
              visibleLegPayloads:
                party === "Regulator"
                  ? []
                  : c.legs.map((l) => ({
                      legId: l.legId,
                      assetCid: l.assetCid,
                      amount: l.amount,
                    })),
            }))
        : compositions
            .filter(
              (c) =>
                c.status === "settled" &&
                (c.proposer === party || c.counterparties.includes(party)),
            )
            .map((c) => ({
              receiptCid: c.receiptCid,
              description: c.description,
              settledAt: c.settledAt,
              legSummaries: c.legSummaries,
              visibleLegPayloads: c.legs
                .filter((l) => l.provider === party || l.receiver === party)
                .map((l) => ({
                  legId: l.legId,
                  assetCid: l.assetCid,
                  amount: l.amount,
                })),
            }));

    return {
      party,
      visibleTokens: tokens,
      compositions: compositions.map((c) => this.redactForParty(c, party)),
      settlementReceipts: receipts,
      privacy: {
        claim:
          party === "Regulator"
            ? "Observer sees SettlementReceipt only; visibleTokens is empty (ledger-enforced)."
            : "Participant sees own legs and co-signed composition state.",
      },
    };
  }

  private redactForParty(c: Composition, party: PartyId) {
    if (party === "Regulator") {
      return {
        id: c.id,
        status: c.status,
        description: c.description,
        settledAt: c.settledAt,
        legSummaries: c.legSummaries,
        legs: [] as LegSpec[],
      };
    }
    return {
      id: c.id,
      proposalCid: c.proposalCid,
      trackerCid: c.trackerCid,
      agreementCid: c.agreementCid,
      receiptCid: c.receiptCid,
      proposer: c.proposer,
      counterparties: c.counterparties,
      accepted: c.accepted,
      description: c.description,
      status: c.status,
      settledAt: c.settledAt,
      legSummaries: c.legSummaries,
      legs: c.legs.filter(
        (l) =>
          party === "Operator" ||
          party === c.proposer ||
          l.provider === party ||
          l.receiver === party ||
          c.counterparties.includes(party),
      ),
    };
  }

  require(id: string): Composition {
    const c = this.compositions.get(id);
    if (!c) throw new Error(`composition ${id} not found`);
    return c;
  }

  listParties() {
    return parties;
  }
}

export const demoStore = new DemoStore();
