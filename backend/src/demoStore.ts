/**
 * In-memory composition engine for LocalNet UI demos when no ledger is configured.
 * Mirrors Propose → Accept → Settle / Revert and per-party ACS visibility (R-PRIV).
 * BitSafe extension: M-of-N governed settlement (R-GOV-1/2) + Emergency Circuit Breaker.
 */
import { createHash, randomUUID } from "node:crypto";
import { getTemplate, type TradeTemplate } from "./tradeTemplates.js";

export type PartyId =
  | "Operator"
  | "Alice"
  | "Bob"
  | "Oracle"
  | "Regulator"
  | "Gov1"
  | "Gov2"
  | "Gov3";

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
  reference: string;
  deadline: string;
  cantonDomain?: string;
};

/** Posted pledge mirrored from Daml LegAllocation — matched field-by-field on settle. */
export type Allocation = {
  allocationCid: string;
  updateId: string;
  legId: string;
  instrumentId: string;
  amount: string;
  provider: PartyId;
  receiver: PartyId;
  assetCid: string;
  reference: string;
  deadline: string;
  allocator: PartyId;
  matched: true;
  matchedFields: string[];
};

export type CommitRecord = {
  updateId: string;
  contractId: string;
  choice: string;
  actAs: PartyId[];
  at: string;
  detail?: string;
};

export type CompositionStatus =
  | "proposed"
  | "partially_accepted"
  | "accepted"
  | "allocating"
  | "ready_to_settle"
  | "awaiting_governance"
  | "settled"
  | "reverted"
  | "cancelled"
  | "expired"
  | "rejected";

export type DisclosedContract = {
  templateId: string;
  contractId: string;
  createdEventBlob?: string;
  payload?: Record<string, unknown>;
};

export type PolicyConfig = {
  maxTransactionAmount?: number;
  blockedParties?: PartyId[];
  feeBps?: number;
};

export type Composition = {
  id: string;
  proposalCid: string;
  trackerCid: string | null;
  agreementCid: string | null;
  receiptCid: string | null;
  governanceCid: string | null;
  executor?: PartyId;
  proposer: PartyId;
  counterparties: PartyId[];
  accepted: PartyId[];
  legs: LegSpec[];
  allocations: Allocation[];
  commits: CommitRecord[];
  description: string;
  status: CompositionStatus;
  dealHash?: string;
  collateralRatio?: string;
  ltvPercent?: number;
  expiresAt?: string;
  allocateBy?: string;
  settleBy?: string;
  policyConfig?: PolicyConfig;
  rejectionReason?: string;
  disclosedContracts?: DisclosedContract[];
  settledAt?: string;
  legSummaries?: { legId: string; instrumentId: string; status: string }[];
  forceFail?: boolean;
  requireGovernance?: boolean;
  /** Catalogue template this trade was created from (e.g. "cocoa"). */
  templateId?: string;
  /** Human-friendly trade name for pickers and dashboards. */
  tradeName?: string;
};

export type Governance = {
  id: string;
  compositionId: string;
  governors: PartyId[];
  threshold: number;
  approvals: PartyId[];
  status: "open" | "executed" | "rejected";
  vetoReason?: string;
};

export type CircuitBreakerState = {
  isHalted: boolean;
  haltReason: string | null;
  haltedBy: string | null;
  updatedAt: string;
};

export type SettlementEvent = {
  id: string;
  type: "settled" | "reverted" | "governed";
  timestamp: string;
  legs: number;
  description: string;
  receiptCid?: string | null;
  governanceCid?: string | null;
};

export type Metrics = {
  compositionsSettled: number;
  compositionsReverted: number;
  legsSettled: number;
  unexpectedFailures: number;
  governedSettlements: number;
  governanceRejections: number;
  totalAttempted: number;
  avgLegsPerComposition: number;
  successRate: number;
  revertRate: number;
  recentEvents: SettlementEvent[];
};

/** Synchronizer each provider settles its leg on (multi-domain demo). */
const CANTON_DOMAINS: Partial<Record<PartyId, string>> = {
  Alice: "canton-domain-rwa-01.eu",
  Bob: "canton-domain-liquidity-02.us",
  Oracle: "canton-domain-onrails-03.global",
};

const parties: PartyId[] = [
  "Operator",
  "Alice",
  "Bob",
  "Oracle",
  "Regulator",
  "Gov1",
  "Gov2",
  "Gov3",
];

export class DemoStore {
  tokens = new Map<string, Token>();
  compositions = new Map<string, Composition>();
  governances = new Map<string, Governance>();
  events: SettlementEvent[] = [];
  circuitBreaker: CircuitBreakerState = {
    isHalted: false,
    haltReason: null,
    haltedBy: null,
    updatedAt: new Date().toISOString(),
  };

  private _rawMetrics = {
    compositionsSettled: 0,
    compositionsReverted: 0,
    legsSettled: 0,
    unexpectedFailures: 0,
    governedSettlements: 0,
    governanceRejections: 0,
  };

  get metrics(): Metrics {
    return this.getMetrics();
  }

  getMetrics(): Metrics {
    const totalAttempted =
      this._rawMetrics.compositionsSettled + this._rawMetrics.compositionsReverted;
    const avgLegsPerComposition =
      this._rawMetrics.compositionsSettled > 0
        ? Number(
            (
              this._rawMetrics.legsSettled / this._rawMetrics.compositionsSettled
            ).toFixed(2),
          )
        : 0;
    const successRate =
      totalAttempted > 0
        ? Number(
            (
              (this._rawMetrics.compositionsSettled / totalAttempted) *
              100
            ).toFixed(1),
          )
        : 100.0;
    const revertRate =
      totalAttempted > 0
        ? Number(
            (
              (this._rawMetrics.compositionsReverted / totalAttempted) *
              100
            ).toFixed(1),
          )
        : 0.0;

    return {
      compositionsSettled: this._rawMetrics.compositionsSettled,
      compositionsReverted: this._rawMetrics.compositionsReverted,
      legsSettled: this._rawMetrics.legsSettled,
      unexpectedFailures: this._rawMetrics.unexpectedFailures,
      governedSettlements: this._rawMetrics.governedSettlements,
      governanceRejections: this._rawMetrics.governanceRejections,
      totalAttempted,
      avgLegsPerComposition,
      successRate,
      revertRate,
      recentEvents: [...this.events],
    };
  }

  recordEvent(event: SettlementEvent) {
    this.events.unshift(event);
    if (this.events.length > 25) {
      this.events.pop();
    }
  }

  constructor() {
    this.seed();
  }

  reset() {
    this.tokens.clear();
    this.compositions.clear();
    this.governances.clear();
    this.events = [];
    this._rawMetrics = {
      compositionsSettled: 0,
      compositionsReverted: 0,
      legsSettled: 0,
      unexpectedFailures: 0,
      governedSettlements: 0,
      governanceRejections: 0,
    };
    this.seed();
  }

  private seed() {
    this.mint("Alice", "CBTC", "2.0");
    this.mint("Bob", "USDCx", "10000.0");
    this.mint("Oracle", "cETH", "1.5");
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
    if (party === "Regulator") return [];
    return [...this.tokens.values()].filter(
      (t) => t.owner === party || party === "Operator",
    );
  }

  propose(input: {
    proposer: PartyId;
    counterparties: PartyId[];
    legs: Array<
      Omit<LegSpec, "reference" | "deadline"> &
        Partial<Pick<LegSpec, "reference" | "deadline">>
    >;
    description: string;
    executor?: PartyId;
    forceFail?: boolean;
    requireGovernance?: boolean;
    expiresAt?: string;
    allocateBy?: string;
    settleBy?: string;
    policyConfig?: PolicyConfig;
    disclosedContracts?: DisclosedContract[];
    templateId?: string;
    tradeName?: string;
    referencePrices?: Record<string, number>;
  }): Composition {
    if (input.legs.length < 2) throw new Error("at least two legs required");

    // Policy hooks: Eligibility & limits checks (FR-19)
    if (input.policyConfig) {
      if (input.policyConfig.blockedParties) {
        if (input.policyConfig.blockedParties.includes(input.proposer)) {
          throw new Error(
            `policy violation: proposer ${input.proposer} is ineligible / sanctioned`,
          );
        }
        for (const cp of input.counterparties) {
          if (input.policyConfig.blockedParties.includes(cp)) {
            throw new Error(
              `policy violation: counterparty ${cp} is ineligible / sanctioned`,
            );
          }
        }
      }
      if (input.policyConfig.maxTransactionAmount) {
        for (const leg of input.legs) {
          if (Number(leg.amount) > input.policyConfig.maxTransactionAmount) {
            throw new Error(
              `policy violation: leg ${leg.legId} amount ${leg.amount} exceeds max transaction limit ${input.policyConfig.maxTransactionAmount}`,
            );
          }
        }
      }
    }

    const defaultDeadline = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const legs: LegSpec[] = input.legs.map((leg) => ({
      ...leg,
      reference: leg.reference ?? `ref-${leg.legId}`,
      deadline: leg.deadline ?? defaultDeadline,
    }));
    for (const leg of legs) {
      const tok = this.tokens.get(leg.assetCid);
      if (!tok) throw new Error(`unknown asset ${leg.assetCid}`);
      if (tok.owner !== leg.provider) {
        throw new Error(`asset ${leg.assetCid} not owned by ${leg.provider}`);
      }
    }
    const id = randomUUID();
    const dealHash = createHash("sha256")
      .update(JSON.stringify({ proposer: input.proposer, counterparties: input.counterparties, legs }))
      .digest("hex");

    // Collateral cover: value of the proposer's delivered legs vs cash received.
    // Defaults to the original CBTC ($65k) / USDCx reference when no prices given.
    let collateralRatio: string | undefined;
    let ltvPercent: number | undefined;
    const prices = input.referencePrices ?? { CBTC: 65000, USDCx: 1 };
    const priced = (l: LegSpec) =>
      prices[l.instrumentId] !== undefined ? Number(l.amount) * prices[l.instrumentId] : 0;
    const collateralVal = legs
      .filter((l) => l.provider === input.proposer && l.instrumentId !== "USDCx")
      .reduce((sum, l) => sum + priced(l), 0);
    const loanVal = legs
      .filter((l) => l.receiver === input.proposer && l.instrumentId === "USDCx")
      .reduce((sum, l) => sum + Number(l.amount), 0);
    if (collateralVal > 0 && loanVal > 0) {
      collateralRatio = `${Math.round((collateralVal / loanVal) * 100)}%`;
      ltvPercent = Number(((loanVal / collateralVal) * 100).toFixed(1));
    }

    const expiresAt =
      input.expiresAt ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const allocateBy = input.allocateBy ?? defaultDeadline;
    const settleBy = input.settleBy ?? defaultDeadline;

    const c: Composition = {
      id,
      proposalCid: `prop-${id}`,
      trackerCid: `trk-${id}`,
      agreementCid: null,
      receiptCid: null,
      governanceCid: null,
      proposer: input.proposer,
      executor: input.executor ?? "Operator",
      counterparties: input.counterparties,
      accepted: [],
      legs,
      allocations: [],
      commits: [],
      description: input.description,
      status: "proposed",
      dealHash,
      collateralRatio,
      ltvPercent,
      expiresAt,
      allocateBy,
      settleBy,
      policyConfig: input.policyConfig,
      disclosedContracts: input.disclosedContracts ?? [],
      forceFail: input.forceFail,
      requireGovernance: input.requireGovernance,
      templateId: input.templateId,
      tradeName: input.tradeName,
    };
    this.compositions.set(id, c);
    this.pushCommit(
      c,
      "Propose",
      c.proposalCid,
      ["Operator", input.proposer],
      `WorkflowProposal created — ${input.legs.length} legs`,
    );
    return c;
  }

  /**
   * Propose a catalogue trade (default: 3-leg cocoa DvP — CBTC + USDCx + cETH).
   * Mints fresh inventory each time so desks can propose repeatedly without
   * colliding with assets already pledged on open tickets.
   */
  proposeTradeFinance(opts?: {
    forceFail?: boolean;
    requireGovernance?: boolean;
    expiresAt?: string;
    templateId?: string;
  }): Composition {
    const template: TradeTemplate = getTemplate(opts?.templateId);
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const minted = template.legs.map((leg) => ({
      leg,
      token: this.mint(leg.provider, leg.instrumentId, leg.amount),
    }));

    return this.propose({
      proposer: "Alice",
      counterparties: template.counterparties,
      description: template.description,
      templateId: template.id,
      tradeName: template.name,
      referencePrices: template.referencePrices,
      forceFail: opts?.forceFail,
      requireGovernance: opts?.requireGovernance,
      expiresAt: opts?.expiresAt,
      disclosedContracts: minted
        .filter(({ leg }) => leg.provider !== "Bob")
        .map(({ leg, token }) => ({
          templateId: "#Composition:MockToken",
          contractId: token.contractId,
          payload: {
            owner: leg.provider,
            instrumentId: leg.instrumentId,
            amount: token.amount,
          },
        })),
      legs: minted.map(({ leg, token }) => ({
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        amount: token.amount,
        provider: leg.provider,
        receiver: leg.receiver,
        assetCid: token.contractId,
        reference: `${template.id}-${leg.legId}`,
        deadline,
        cantonDomain: CANTON_DOMAINS[leg.provider] ?? "canton-domain-global",
      })),
    });
  }

  private pushCommit(
    c: Composition,
    choice: string,
    contractId: string,
    actAs: PartyId[],
    detail?: string,
  ): CommitRecord {
    const commit: CommitRecord = {
      updateId: `upd-${randomUUID().slice(0, 12)}`,
      contractId,
      choice,
      actAs,
      at: new Date().toISOString(),
      detail,
    };
    c.commits = [...c.commits, commit];
    return commit;
  }

  accept(compositionId: string, acceptor: PartyId): Composition {
    const c = this.require(compositionId);
    if (!c.counterparties.includes(acceptor)) {
      throw new Error(`${acceptor} is not a counterparty`);
    }
    // Mirrors FinalizeAgreement: a cancelled / rejected / expired proposal
    // cannot be accepted into an agreement.
    if (["cancelled", "rejected", "expired", "reverted", "settled"].includes(c.status)) {
      throw new Error(`cannot accept: proposal is ${c.status}`);
    }
    if (c.accepted.includes(acceptor)) return c;
    c.accepted = [...c.accepted, acceptor];
    const allAccepted = c.counterparties.every((p) => c.accepted.includes(p));
    c.status = allAccepted ? "accepted" : "partially_accepted";
    // Every signature is its own commit (mirrors ledgerWorkflow: AcceptProposal per party)
    this.pushCommit(
      c,
      "AcceptProposal",
      c.trackerCid ?? c.proposalCid,
      ["Operator", acceptor],
      `${acceptor} signed the trade terms`,
    );
    if (allAccepted) {
      c.agreementCid = `agr-${c.id}`;
      this.pushCommit(
        c,
        "FinalizeAgreement",
        c.agreementCid,
        ["Operator"],
        "All counterparties accepted — agreement formed; allocations required before Settle",
      );
    }
    return c;
  }

  /**
   * Post a LegAllocation against one agreed leg.
   * Mirrors Daml matchAllocationToLeg — ANY field mismatch rejects (no store mutation).
   */
  allocate(
    compositionId: string,
    input: {
      legId: string;
      instrumentId: string;
      amount: string;
      provider: PartyId;
      receiver: PartyId;
      assetCid: string;
      reference: string;
      deadline: string;
      allocator?: PartyId;
    },
  ): { composition: Composition; allocation: Allocation; commit: CommitRecord } {
    const c = this.require(compositionId);
    if (c.allocateBy && new Date(c.allocateBy).getTime() < Date.now()) {
      throw new Error(
        `allocation match failed: allocate-by deadline passed (${c.allocateBy})`,
      );
    }
    if (
      c.status !== "accepted" &&
      c.status !== "allocating" &&
      c.status !== "ready_to_settle"
    ) {
      throw new Error(
        "allocation match failed: agreement not ready — accept all counterparties first",
      );
    }
    const leg = c.legs.find((l) => l.legId === input.legId);
    if (!leg) {
      throw new Error(
        `allocation match failed: no allocation posted for leg ${input.legId}`,
      );
    }
    if (c.allocations.some((a) => a.legId === input.legId)) {
      throw new Error(
        `allocation match failed: leg ${input.legId} already allocated`,
      );
    }

    const allocator = input.allocator ?? input.provider;
    // Field-by-field checks — same message prefixes as Composition.daml
    if (input.legId !== leg.legId) {
      throw new Error(
        `allocation match failed: legId mismatch (agreed=${leg.legId}, allocated=${input.legId})`,
      );
    }
    if (input.provider !== leg.provider) {
      throw new Error(
        `allocation match failed: provider party mismatch on leg ${leg.legId}`,
      );
    }
    if (input.receiver !== leg.receiver) {
      throw new Error(
        `allocation match failed: receiver party mismatch on leg ${leg.legId}`,
      );
    }
    if (allocator !== leg.provider) {
      throw new Error(
        `allocation match failed: allocator must be provider on leg ${leg.legId}`,
      );
    }
    if (Number(input.amount) !== Number(leg.amount)) {
      throw new Error(
        `allocation match failed: amount mismatch on leg ${leg.legId}`,
      );
    }
    if (input.instrumentId !== leg.instrumentId) {
      throw new Error(
        `allocation match failed: instrumentId mismatch on leg ${leg.legId}`,
      );
    }
    if (input.reference !== leg.reference) {
      throw new Error(
        `allocation match failed: reference mismatch on leg ${leg.legId}`,
      );
    }
    if (input.deadline !== leg.deadline) {
      throw new Error(
        `allocation match failed: deadline mismatch on leg ${leg.legId}`,
      );
    }
    if (new Date(input.deadline).getTime() < Date.now()) {
      throw new Error(
        `allocation match failed: settlement past deadline on leg ${leg.legId}`,
      );
    }
    if (input.assetCid !== leg.assetCid) {
      throw new Error(
        `allocation match failed: assetCid mismatch on leg ${leg.legId}`,
      );
    }
    const tok = this.tokens.get(input.assetCid);
    if (!tok) {
      throw new Error(
        `allocation match failed: live asset missing on leg ${leg.legId}`,
      );
    }
    if (tok.owner !== leg.provider) {
      throw new Error(
        `allocation match failed: live asset owner != provider on leg ${leg.legId}`,
      );
    }
    if (tok.instrumentId !== leg.instrumentId) {
      throw new Error(
        `allocation match failed: live asset instrumentId mismatch on leg ${leg.legId}`,
      );
    }
    if (Number(tok.amount) !== Number(leg.amount)) {
      throw new Error(
        `allocation match failed: live asset amount mismatch on leg ${leg.legId}`,
      );
    }

    const allocationCid = `alloc-${c.id}-${leg.legId}`;
    const allocation: Allocation = {
      allocationCid,
      updateId: "",
      legId: leg.legId,
      instrumentId: leg.instrumentId,
      amount: leg.amount,
      provider: leg.provider,
      receiver: leg.receiver,
      assetCid: leg.assetCid,
      reference: leg.reference,
      deadline: leg.deadline,
      allocator,
      matched: true,
      matchedFields: [
        "legId",
        "provider",
        "receiver",
        "amount",
        "instrumentId",
        "reference",
        "deadline",
        "assetCid",
        "liveOwner",
        "liveInstrument",
        "liveAmount",
      ],
    };
    c.allocations = [...c.allocations, allocation];
    c.status =
      c.allocations.length === c.legs.length ? "ready_to_settle" : "allocating";
    const commit = this.pushCommit(
      c,
      "AllocateLeg",
      allocationCid,
      ["Operator", allocator],
      `Matched ${allocation.matchedFields.join(", ")} on leg ${leg.legId}`,
    );
    allocation.updateId = commit.updateId;
    return { composition: c, allocation, commit };
  }

  /** Allocate every leg with agreed terms (happy path / one-click). */
  allocateAll(compositionId: string): Composition {
    const c = this.require(compositionId);
    for (const leg of c.legs) {
      if (!c.allocations.some((a) => a.legId === leg.legId)) {
        this.allocate(compositionId, { ...leg });
      }
    }
    return this.require(compositionId);
  }

  /**
   * FR-10: Withdraw a previously posted leg allocation before settlement.
   * Reverts composition status from ready_to_settle to allocating.
   * Releases the allocation back to the provider.
   */
  withdrawLeg(
    compositionId: string,
    legId: string,
    caller: PartyId,
  ): { composition: Composition; withdrawnAllocation: Allocation; commit: CommitRecord } {
    const c = this.require(compositionId);
    if (c.status === "settled") {
      throw new Error("cannot withdraw leg: composition already settled");
    }
    const allocIndex = c.allocations.findIndex((a) => a.legId === legId);
    if (allocIndex === -1) {
      throw new Error(`cannot withdraw leg: no allocation posted for leg ${legId}`);
    }
    const alloc = c.allocations[allocIndex];
    if (alloc.provider !== caller && caller !== "Operator") {
      throw new Error(
        `cannot withdraw leg: only leg provider ${alloc.provider} or Operator can withdraw allocation`,
      );
    }
    const [withdrawnAllocation] = c.allocations.splice(allocIndex, 1);
    c.status = "allocating";
    const commit = this.pushCommit(
      c,
      "WithdrawLegAllocation",
      alloc.allocationCid,
      ["Operator", caller],
      `Withdrew CIP-56 allocation for leg ${legId} by ${caller}`,
    );
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: new Date().toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Leg ${legId} allocation withdrawn by ${caller})`,
    });
    return { composition: c, withdrawnAllocation, commit };
  }

  /**
   * FR-13 & FR-7: Stage-based cancellation permissioning.
   * - In proposed/partially_accepted stage: only proposer or Operator can cancel.
   * - In accepted/allocating/ready_to_settle stage: proposer, counterparties, or Operator can cancel.
   * - In settled stage: cancellation is permanently blocked.
   * Releases any locked leg allocations back to participants (FR-7 & FR-10).
   */
  cancel(compositionId: string, caller: PartyId): Composition {
    const c = this.require(compositionId);
    if (c.status === "settled") throw new Error("cannot cancel settled composition");
    
    const isProposer = c.proposer === caller;
    const isOperator = caller === "Operator";
    const isCounterparty = c.counterparties.includes(caller);

    if ((c.status === "proposed" || c.status === "partially_accepted") && !isProposer && !isOperator) {
      throw new Error(`stage permission: only proposer ${c.proposer} or Operator can cancel proposal`);
    }

    if (!isProposer && !isOperator && !isCounterparty) {
      throw new Error(`stage permission: unauthorized caller ${caller} cannot cancel trade`);
    }

    c.status = "cancelled";
    c.allocations = []; // release locked allocations
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: new Date().toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Cancelled by ${caller} — allocations released)`,
    });
    return c;
  }

  /**
   * FR-12: Expiry path: resolves stalled or timed-out proposals/settlements cleanly.
   * Releases any locked allocations so no trade is stranded.
   */
  expire(
    compositionId: string,
    caller: PartyId = "Operator",
    simulatedNow?: Date,
  ): Composition {
    const c = this.require(compositionId);
    if (c.status === "settled") throw new Error("cannot expire settled composition");
    const now = simulatedNow ?? new Date();

    const isExpiredAt = Boolean(c.expiresAt && now >= new Date(c.expiresAt));
    const isAllocateByExpired = Boolean(
      c.allocateBy && now >= new Date(c.allocateBy) && c.status !== "ready_to_settle",
    );
    const isSettleByExpired = Boolean(c.settleBy && now >= new Date(c.settleBy));

    if (!isExpiredAt && !isAllocateByExpired && !isSettleByExpired) {
      throw new Error(`proposal has not expired (expires at ${c.expiresAt ?? c.allocateBy ?? c.settleBy})`);
    }
    c.status = "expired";
    c.allocations = []; // release locked allocations so funds are never stranded (FR-12)
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: now.toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Expired by ${caller} — allocations released)`,
    });
    return c;
  }

  /** Counterparty rejection: cleanly rejects proposal */
  reject(compositionId: string, rejector: PartyId, reason: string): Composition {
    const c = this.require(compositionId);
    if (c.status === "settled") throw new Error("cannot reject settled composition");
    if (!c.counterparties.includes(rejector) && rejector !== "Operator") {
      throw new Error(`${rejector} is not an authorized counterparty`);
    }
    c.status = "rejected";
    c.rejectionReason = reason;
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: new Date().toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Rejected by ${rejector}: ${reason})`,
    });
    return c;
  }

  /** Toggle emergency circuit breaker for institutional halts */
  toggleCircuitBreaker(caller: PartyId, reason?: string): CircuitBreakerState {
    const isNowHalted = !this.circuitBreaker.isHalted;
    this.circuitBreaker = {
      isHalted: isNowHalted,
      haltReason: isNowHalted ? (reason ?? "Emergency governor circuit breaker triggered") : null,
      haltedBy: isNowHalted ? caller : null,
      updatedAt: new Date().toISOString(),
    };
    return this.circuitBreaker;
  }

  /**
   * Atomic settle. Enforces circuit breaker, governance gates, and all-or-nothing execution.
   */
  settle(compositionId: string, withRegulator = true, caller?: PartyId): Composition {
    if (this.circuitBreaker.isHalted) {
      throw new Error(
        `settlement rejected: protocol circuit breaker is active (${this.circuitBreaker.haltReason ?? "emergency halt"})`,
      );
    }
    let c = this.require(compositionId);
    if (c.settleBy && new Date(c.settleBy).getTime() < Date.now()) {
      throw new Error(
        `settlement rejected: settle-by deadline passed (${c.settleBy})`,
      );
    }
    if (caller && c.executor && caller !== c.executor && caller !== "Operator") {
      throw new Error(
        `settlement rejected: wrong executor (caller ${caller} is not designated executor ${c.executor})`,
      );
    }
    if (
      c.status !== "accepted" &&
      c.status !== "allocating" &&
      c.status !== "ready_to_settle" &&
      c.status !== "awaiting_governance"
    ) {
      throw new Error("composition not fully accepted");
    }

    // Desk convenience: when no allocations were posted yet (Exporter /
    // BitSafe / Readiness clicked Settle), match all legs to agreed terms.
    // Partial / withdrawn sets still fail the completeness gate below.
    // Explicit /allocate (incl. mismatch rejects) still runs on /demo.
    if (c.status !== "awaiting_governance" && c.allocations.length === 0) {
      this.allocateAll(compositionId);
      c = this.require(compositionId);
    }

    if (
      c.requireGovernance &&
      (c.status === "accepted" ||
        c.status === "ready_to_settle" ||
        c.status === "allocating")
    ) {
      const gov = this.openGovernance(c.id, ["Gov1", "Gov2", "Gov3"], 2);
      c.governanceCid = gov.id;
      c.status = "awaiting_governance";
      return c;
    }

    if (c.requireGovernance && c.status === "awaiting_governance") {
      throw new Error(
        "governed settlement: threshold not met — use governance approve/execute",
      );
    }

    // Completeness gate (same as Daml fetchAllocationsByLeg)
    if (c.allocations.length !== c.legs.length) {
      throw new Error(
        `allocation match failed: expected ${c.legs.length} allocations, got ${c.allocations.length}`,
      );
    }
    for (const leg of c.legs) {
      if (!c.allocations.some((a) => a.legId === leg.legId)) {
        throw new Error(
          `allocation match failed: no allocation posted for leg ${leg.legId}`,
        );
      }
    }

    return this.executeSettle(c, withRegulator);
  }

  private executeSettle(c: Composition, withRegulator: boolean): Composition {
    if (c.allocations.length !== c.legs.length) {
      throw new Error(
        `allocation match failed: expected ${c.legs.length} allocations, got ${c.allocations.length}`,
      );
    }
    if (c.forceFail) {
      c.status = "reverted";
      this._rawMetrics.compositionsReverted += 1;
      this.recordEvent({
        id: c.id,
        type: "reverted",
        timestamp: new Date().toISOString(),
        legs: c.legs.length,
        description: `${c.description} (forced revert)`,
      });
      throw new Error("atomic settle reverted: leg Transfer failed");
    }
    for (const leg of c.legs) {
      const tok = this.tokens.get(leg.assetCid);
      if (!tok || tok.owner !== leg.provider) {
        c.status = "reverted";
        this._rawMetrics.compositionsReverted += 1;
        this.recordEvent({
          id: c.id,
          type: "reverted",
          timestamp: new Date().toISOString(),
          legs: c.legs.length,
          description: `${c.description} (leg ${leg.legId} failed)`,
        });
        throw new Error(`atomic settle reverted: leg ${leg.legId} failed`);
      }
    }
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
    this.pushCommit(
      c,
      withRegulator ? "SettleWithRegulator" : "Settle",
      c.receiptCid,
      ["Operator", ...new Set(c.legs.flatMap((l) => [l.provider, l.receiver]))],
      "All allocations matched — legs transferred atomically; SettlementReceipt created",
    );
    this._rawMetrics.compositionsSettled += 1;
    this._rawMetrics.legsSettled += c.legs.length;
    this.recordEvent({
      id: c.id,
      type: c.requireGovernance ? "governed" : "settled",
      timestamp: c.settledAt,
      legs: c.legs.length,
      description: c.description,
      receiptCid: c.receiptCid,
      governanceCid: c.governanceCid,
    });
    return c;
  }

  openGovernance(
    compositionId: string,
    governors: PartyId[],
    threshold: number,
  ): Governance {
    const c = this.require(compositionId);
    if (
      c.status !== "accepted" &&
      c.status !== "ready_to_settle" &&
      c.status !== "allocating" &&
      c.status !== "awaiting_governance"
    ) {
      throw new Error("governance requires an accepted agreement");
    }
    if (threshold < 1 || threshold > governors.length) {
      throw new Error("invalid threshold");
    }
    const id = randomUUID();
    const gov: Governance = {
      id,
      compositionId,
      governors,
      threshold,
      approvals: [],
      status: "open",
    };
    this.governances.set(id, gov);
    c.governanceCid = id;
    c.requireGovernance = true;
    c.status = "awaiting_governance";
    return gov;
  }

  approveGovernance(governanceId: string, governor: PartyId): Governance {
    const gov = this.requireGov(governanceId);
    if (gov.status !== "open") throw new Error("governance not open");
    if (!gov.governors.includes(governor)) {
      throw new Error(`${governor} is not a named governor`);
    }
    if (!gov.approvals.includes(governor)) {
      gov.approvals = [...gov.approvals, governor];
    }
    return gov;
  }

  /** R-GOV-1: MUST NOT execute below threshold; MUST succeed once met. */
  executeGovernance(governanceId: string): Composition {
    const gov = this.requireGov(governanceId);
    if (gov.status !== "open") throw new Error("governance not open");
    if (gov.approvals.length < gov.threshold) {
      this._rawMetrics.governanceRejections += 1;
      throw new Error(
        `below threshold: ${gov.approvals.length}/${gov.threshold} — governed action rejected`,
      );
    }
    const c = this.require(gov.compositionId);
    c.requireGovernance = false;
    c.status = "accepted";
    if (c.allocations.length < c.legs.length) {
      this.allocateAll(c.id);
    }
    const settled = this.executeSettle(c, true);
    gov.status = "executed";
    this._rawMetrics.governedSettlements += 1;
    return settled;
  }

  /** Institutional Emergency Veto: Allows named governor to abort an open deal */
  vetoGovernance(governanceId: string, governor: PartyId, reason: string): Governance {
    const gov = this.requireGov(governanceId);
    if (gov.status !== "open") throw new Error("governance not open");
    if (!gov.governors.includes(governor)) {
      throw new Error(`${governor} is not a named governor`);
    }
    gov.status = "rejected";
    gov.vetoReason = reason;
    const c = this.require(gov.compositionId);
    c.status = "reverted";
    this._rawMetrics.governanceRejections += 1;
    this._rawMetrics.compositionsReverted += 1;
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: new Date().toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Vetoed by ${governor}: ${reason})`,
      governanceCid: gov.id,
    });
    return gov;
  }

  /** Pitch path: propose → accept all → allocate all → settle → money-shot payload. */
  runFullDemo(opts?: {
    forceFail?: boolean;
    requireGovernance?: boolean;
    templateId?: string;
  }) {
    const composition = this.proposeTradeFinance(opts);
    for (const p of composition.counterparties) {
      this.accept(composition.id, p);
    }
    this.allocateAll(composition.id);
    let settled: Composition | null = null;
    let error: string | null = null;
    try {
      settled = this.settle(composition.id, true);
      if (settled.status === "awaiting_governance" && settled.governanceCid) {
        // Auto-approve to threshold for happy-path pitch unless caller drives gov UI
        const gov = this.requireGov(settled.governanceCid);
        for (const g of gov.governors.slice(0, gov.threshold)) {
          this.approveGovernance(gov.id, g);
        }
        settled = this.executeGovernance(gov.id);
      }
    } catch (e) {
      error = (e as Error).message;
    }
    return {
      composition: this.require(composition.id),
      settled,
      error,
      moneyShot: {
        participant: this.partyView("Bob"),
        observer: this.partyView("Regulator"),
      },
      metrics: this.metrics,
    };
  }

  /** Burn metrics evidence: settle N happy-path compositions. */
  runLoad(count: number, templateId?: string) {
    const results = [];
    for (let i = 0; i < count; i++) {
      // proposeTradeFinance mints fresh inventory for each deal
      results.push(this.runFullDemo({ templateId }));
    }
    return { ran: count, metrics: this.metrics, last: results.at(-1) };
  }

  partyView(party: PartyId, compositionId?: string) {
    const scoped = compositionId ? this.require(compositionId) : null;
    const scopedAssets = scoped ? new Set(scoped.legs.map((l) => l.assetCid)) : null;
    const tokens = this.listTokens(party).filter(
      (t) => !scopedAssets || scopedAssets.has(t.contractId),
    );
    const compositions = [...this.compositions.values()].filter((c) => {
      if (scoped && c.id !== scoped.id) return false;
      if (party === "Operator" || party === c.proposer) return true;
      if (c.counterparties.includes(party)) return true;
      if (party === "Regulator") return c.status === "settled";
      if (party.startsWith("Gov")) return Boolean(c.governanceCid);
      return false;
    });

    const order = [...this.compositions.keys()];
    const newestFirst = (a: Composition, b: Composition) =>
      (b.settledAt ?? "").localeCompare(a.settledAt ?? "") ||
      order.indexOf(b.id) - order.indexOf(a.id);
    const receipts =
      party === "Regulator" || party === "Operator"
        ? compositions
            .filter((c) => c.status === "settled")
            .sort(newestFirst)
            .map((c) => ({
              compositionId: c.id,
              tradeName: c.tradeName,
              receiptCid: c.receiptCid,
              description: c.description,
              settledAt: c.settledAt,
              legSummaries: c.legSummaries,
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
            .sort(newestFirst)
            .map((c) => ({
              compositionId: c.id,
              tradeName: c.tradeName,
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

    const governance = [...this.governances.values()].filter((g) =>
      g.governors.includes(party) || party === "Operator",
    );

    const auditEvents = this.events
      .filter((e) => {
        if (party === "Operator" || party === "Regulator") return true;
        const c = this.compositions.get(e.id);
        if (!c) return false;
        return (
          c.proposer === party ||
          c.counterparties.includes(party) ||
          e.description.includes(party)
        );
      })
      .map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        legs: e.legs,
        description: e.description,
      }));

    return {
      party,
      visibleTokens: tokens,
      compositions: compositions.map((c) => this.redactForParty(c, party)),
      settlementReceipts: receipts,
      governance,
      auditEvents,
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
        tradeName: c.tradeName,
        status: c.status,
        description: c.description,
        settledAt: c.settledAt,
        legSummaries: c.legSummaries,
        legs: [] as LegSpec[],
        governanceCid: c.governanceCid,
      };
    }
    return {
      id: c.id,
      proposalCid: c.proposalCid,
      trackerCid: c.trackerCid,
      agreementCid: c.agreementCid,
      receiptCid: c.receiptCid,
      governanceCid: c.governanceCid,
      tradeName: c.tradeName,
      commits: c.commits,
      proposer: c.proposer,
      counterparties: c.counterparties,
      accepted: c.accepted,
      description: c.description,
      status: c.status,
      settledAt: c.settledAt,
      legSummaries: c.legSummaries,
      requireGovernance: c.requireGovernance,
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

  getReadiness(id: string) {
    const c = this.compositions.get(id);
    if (!c) throw new Error(`composition ${id} not found`);

    const settled = c.status === "settled";
    const allocatedLegs = c.allocations.map((a) => ({
      legId: a.legId,
      instrumentId: a.instrumentId,
      amount: a.amount,
      provider: a.provider,
      receiver: a.receiver,
      matched: a.matched === true,
      allocationCid: a.allocationCid,
      updateId: a.updateId,
      settled,
    }));

    const allocatedLegIds = new Set(c.allocations.map((a) => a.legId));
    const outstandingLegs = c.legs
      .filter((leg) => !allocatedLegIds.has(leg.legId))
      .map((leg) => ({
        legId: leg.legId,
        provider: leg.provider,
        receiver: leg.receiver,
        instrumentId: leg.instrumentId,
        amount: leg.amount,
        deadline: leg.deadline,
      }));

    const now = Date.now();
    const isAllocateExpired = Boolean(c.allocateBy && new Date(c.allocateBy).getTime() < now);
    const isSettleExpired = Boolean(c.settleBy && new Date(c.settleBy).getTime() < now);

    const outstandingParties = Array.from(
      new Set([
        ...c.counterparties.filter((cp) => !c.accepted.includes(cp)),
        ...outstandingLegs.map((l) => l.provider),
      ]),
    );

    const allLegsAllocated = c.legs.length > 0 && c.allocations.length >= c.legs.length;
    const allAccepted = c.counterparties.every((cp) => c.accepted.includes(cp));
    const isReady = allLegsAllocated && allAccepted && !isAllocateExpired && !isSettleExpired;
    const canSettle =
      isReady &&
      !this.circuitBreaker.isHalted &&
      c.status !== "settled" &&
      c.status !== "reverted" &&
      c.status !== "cancelled" &&
      c.status !== "expired" &&
      c.status !== "rejected";

    return {
      compositionId: c.id,
      tradeName: c.tradeName ?? "Custom trade",
      templateId: c.templateId,
      description: c.description,
      receiptCid: c.receiptCid,
      settledAt: c.settledAt,
      governanceCid: c.governanceCid,
      requireGovernance: Boolean(c.requireGovernance),
      status: c.status,
      isReady,
      totalLegs: c.legs.length,
      allocatedLegCount: c.allocations.length,
      allocatedLegs,
      outstandingLegs,
      parties: {
        proposer: {
          party: c.proposer,
          accepted: true,
          allocated: c.allocations.some((a) => a.provider === c.proposer),
        },
        counterparties: c.counterparties.map((cp) => ({
          party: cp,
          accepted: c.accepted.includes(cp),
          allocated: c.allocations.some((a) => a.provider === cp),
        })),
      },
      outstandingParties,
      allocateBy: c.allocateBy,
      settleBy: c.settleBy,
      isAllocateExpired,
      isSettleExpired,
      canSettle,
    };
  }

  require(id: string): Composition {
    const c = this.compositions.get(id);
    if (!c) throw new Error(`composition ${id} not found`);
    return c;
  }

  requireGov(id: string): Governance {
    const g = this.governances.get(id);
    if (!g) throw new Error(`governance ${id} not found`);
    return g;
  }

  listParties() {
    return parties;
  }
}

export const demoStore = new DemoStore();
