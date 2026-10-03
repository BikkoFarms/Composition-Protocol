/**
 * In-memory composition engine for LocalNet UI demos when no ledger is configured.
 * Mirrors Propose → Accept → Settle / Revert and per-party ACS visibility (R-PRIV).
 * BitSafe extension: M-of-N governed settlement (R-GOV-1/2) + Emergency Circuit Breaker.
 */
import { createHash, randomUUID } from "node:crypto";

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

export type Composition = {
  id: string;
  proposalCid: string;
  trackerCid: string | null;
  agreementCid: string | null;
  receiptCid: string | null;
  governanceCid: string | null;
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
  rejectionReason?: string;
  disclosedContracts?: DisclosedContract[];
  settledAt?: string;
  legSummaries?: { legId: string; instrumentId: string; status: string }[];
  forceFail?: boolean;
  requireGovernance?: boolean;
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
    forceFail?: boolean;
    requireGovernance?: boolean;
    expiresAt?: string;
    disclosedContracts?: DisclosedContract[];
  }): Composition {
    if (input.legs.length < 2) throw new Error("at least two legs required");
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

    // Institutional collateral valuation (e.g. 1 CBTC = $65,000 reference valuation vs USDCx loan)
    let collateralRatio: string | undefined;
    let ltvPercent: number | undefined;
    const cbtcLeg = legs.find((l) => l.instrumentId === "CBTC");
    const usdcLeg = legs.find((l) => l.instrumentId === "USDCx");
    if (cbtcLeg && usdcLeg) {
      const cbtcVal = Number(cbtcLeg.amount) * 65000;
      const loanVal = Number(usdcLeg.amount);
      if (loanVal > 0) {
        collateralRatio = `${Math.round((cbtcVal / loanVal) * 100)}%`;
        ltvPercent = Number(((loanVal / cbtcVal) * 100).toFixed(1));
      }
    }

    const expiresAt =
      input.expiresAt ??
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const c: Composition = {
      id,
      proposalCid: `prop-${id}`,
      trackerCid: `trk-${id}`,
      agreementCid: null,
      receiptCid: null,
      governanceCid: null,
      proposer: input.proposer,
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
      disclosedContracts: input.disclosedContracts ?? [],
      forceFail: input.forceFail,
      requireGovernance: input.requireGovernance,
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

  /** Seed 3-leg sponsor-asset DvP: CBTC + USDCx + cETH (BitSafe / onRails). */
  proposeTradeFinance(opts?: {
    forceFail?: boolean;
    requireGovernance?: boolean;
    expiresAt?: string;
  }): Composition {
    const collateral =
      this.listTokens("Alice").find((t) => t.instrumentId === "CBTC") ??
      this.mint("Alice", "CBTC", "2.0");
    const cash =
      this.listTokens("Bob").find((t) => t.instrumentId === "USDCx") ??
      this.mint("Bob", "USDCx", "10000.0");
    const ceth =
      this.listTokens("Oracle").find((t) => t.instrumentId === "cETH") ??
      this.mint("Oracle", "cETH", "1.5");

    return this.propose({
      proposer: "Alice",
      counterparties: ["Bob", "Oracle"],
      description:
        "African cocoa export — CBTC collateral + USDCx cash + cETH sponsor leg",
      forceFail: opts?.forceFail,
      requireGovernance: opts?.requireGovernance,
      expiresAt: opts?.expiresAt,
      disclosedContracts: [
        {
          templateId: "#Composition:MockToken",
          contractId: collateral.contractId,
          payload: {
            owner: "Alice",
            instrumentId: "CBTC",
            amount: collateral.amount,
          },
        },
        {
          templateId: "#Composition:MockToken",
          contractId: ceth.contractId,
          payload: {
            owner: "Oracle",
            instrumentId: "cETH",
            amount: ceth.amount,
          },
        },
      ],
      legs: [
        {
          legId: "collateral",
          instrumentId: "CBTC",
          amount: collateral.amount,
          provider: "Alice",
          receiver: "Bob",
          assetCid: collateral.contractId,
          reference: "tf-collateral",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cantonDomain: "canton-domain-rwa-01.eu",
        },
        {
          legId: "cash",
          instrumentId: "USDCx",
          amount: cash.amount,
          provider: "Bob",
          receiver: "Alice",
          assetCid: cash.contractId,
          reference: "tf-cash",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cantonDomain: "canton-domain-liquidity-02.us",
        },
        {
          legId: "sponsor",
          instrumentId: "cETH",
          amount: ceth.amount,
          provider: "Oracle",
          receiver: "Bob",
          assetCid: ceth.contractId,
          reference: "tf-sponsor",
          deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          cantonDomain: "canton-domain-onrails-03.global",
        },
      ],
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
    if (c.accepted.includes(acceptor)) return c;
    c.accepted = [...c.accepted, acceptor];
    const allAccepted = c.counterparties.every((p) => c.accepted.includes(p));
    c.status = allAccepted ? "accepted" : "partially_accepted";
    if (allAccepted) {
      c.agreementCid = `agr-${c.id}`;
      this.pushCommit(
        c,
        "FinalizeAgreement",
        c.agreementCid,
        ["Operator"],
        "All counterparties accepted — agreement formed; allocations required before Settle",
      );
    } else {
      this.pushCommit(
        c,
        "AcceptProposal",
        c.trackerCid ?? c.proposalCid,
        ["Operator", acceptor],
        `${acceptor} recorded on AcceptanceTracker`,
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
    if (input.amount !== leg.amount) {
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
    if (tok.amount !== leg.amount) {
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

  /** Proposer cancellation before execution */
  cancel(compositionId: string, caller: PartyId): Composition {
    const c = this.require(compositionId);
    if (c.status === "settled") throw new Error("cannot cancel settled composition");
    if (c.proposer !== caller && caller !== "Operator") {
      throw new Error(`only proposer ${c.proposer} or Operator can cancel`);
    }
    c.status = "cancelled";
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: new Date().toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Cancelled by ${caller})`,
    });
    return c;
  }

  /** Expiry path: resolves stalled or timed-out proposals cleanly */
  expire(
    compositionId: string,
    caller: PartyId = "Operator",
    simulatedNow?: Date,
  ): Composition {
    const c = this.require(compositionId);
    if (c.status === "settled") throw new Error("cannot expire settled composition");
    const now = simulatedNow ?? new Date();
    if (c.expiresAt && now < new Date(c.expiresAt)) {
      throw new Error(`proposal has not expired (expires at ${c.expiresAt})`);
    }
    c.status = "expired";
    this.recordEvent({
      id: c.id,
      type: "reverted",
      timestamp: now.toISOString(),
      legs: c.legs.length,
      description: `${c.description} (Expired by ${caller})`,
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
  settle(compositionId: string, withRegulator = true): Composition {
    if (this.circuitBreaker.isHalted) {
      throw new Error(
        `settlement rejected: protocol circuit breaker is active (${this.circuitBreaker.haltReason ?? "emergency halt"})`,
      );
    }
    const c = this.require(compositionId);
    if (
      c.status !== "accepted" &&
      c.status !== "allocating" &&
      c.status !== "ready_to_settle" &&
      c.status !== "awaiting_governance"
    ) {
      throw new Error("composition not fully accepted");
    }

    // Completeness gate (same as Daml fetchAllocationsByLeg)
    if (c.status !== "awaiting_governance") {
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
  runFullDemo(opts?: { forceFail?: boolean; requireGovernance?: boolean }) {
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
  runLoad(count: number) {
    const results = [];
    for (let i = 0; i < count; i++) {
      // Fresh inventory each deal
      this.mint("Alice", "CBTC", "2.0");
      this.mint("Bob", "USDCx", "10000.0");
      this.mint("Oracle", "cETH", "1.5");
      results.push(this.runFullDemo());
    }
    return { ran: count, metrics: this.metrics, last: results.at(-1) };
  }

  partyView(party: PartyId) {
    const tokens = this.listTokens(party);
    const compositions = [...this.compositions.values()].filter((c) => {
      if (party === "Operator" || party === c.proposer) return true;
      if (c.counterparties.includes(party)) return true;
      if (party === "Regulator") return c.status === "settled";
      if (party.startsWith("Gov")) return Boolean(c.governanceCid);
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

    const governance = [...this.governances.values()].filter((g) =>
      g.governors.includes(party) || party === "Operator",
    );

    return {
      party,
      visibleTokens: tokens,
      compositions: compositions.map((c) => this.redactForParty(c, party)),
      settlementReceipts: receipts,
      governance,
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
