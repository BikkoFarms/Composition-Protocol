/**
 * SettleFlow: Settlement Backend Adapter Interface (FR-16)
 *
 * Provides a standardized abstraction layer decoupling the trade-level coordination
 * engine from the underlying settlement substrate (Canton Ledger API v2, In-Memory Demo,
 * Daml Finance Batch/Instruction, or Custodian settlement rails).
 */
import {
  demoStore,
  type Composition,
  type Allocation,
  type PartyId,
  type LegSpec,
  type CommitRecord,
  type PolicyConfig,
} from "./demoStore.js";

export interface ProposalTerms {
  proposer: PartyId;
  counterparties: PartyId[];
  legs: Array<
    Omit<LegSpec, "reference" | "deadline"> &
      Partial<Pick<LegSpec, "reference" | "deadline">>
  >;
  description: string;
  executor?: PartyId;
  allocateBy?: string;
  settleBy?: string;
  policyConfig?: PolicyConfig;
}

export interface AllocationInput {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: PartyId;
  receiver: PartyId;
  assetCid: string;
  reference: string;
  deadline: string;
  allocator?: PartyId;
}

export interface ReadinessReport {
  compositionId: string;
  status: string;
  isReady: boolean;
  totalLegs: number;
  allocatedLegCount: number;
  canSettle: boolean;
  allocateBy?: string;
  settleBy?: string;
  isAllocateExpired: boolean;
  isSettleExpired: boolean;
}

/**
 * Standardized Settlement Backend Adapter Interface (FR-16)
 */
export interface ISettlementBackendAdapter {
  readonly mode: "demo" | "ledger";

  propose(terms: ProposalTerms): Promise<Composition>;
  accept(compositionId: string, party: PartyId): Promise<Composition>;
  allocate(
    compositionId: string,
    allocation: AllocationInput,
  ): Promise<{ composition: Composition; allocation: Allocation; commit: CommitRecord }>;
  withdrawLeg(
    compositionId: string,
    legId: string,
    caller: PartyId,
  ): Promise<{ composition: Composition; withdrawnAllocation: Allocation; commit: CommitRecord }>;
  settle(compositionId: string, withRegulator?: boolean, caller?: PartyId): Promise<Composition>;
  cancel(compositionId: string, caller: PartyId): Promise<Composition>;
  expire(compositionId: string, caller?: PartyId, simulatedNow?: Date): Promise<Composition>;
  getReadiness(compositionId: string): Promise<ReadinessReport>;
  getPartyView(party: PartyId): Promise<ReturnType<typeof demoStore.partyView>>;
}

/**
 * High-fidelity in-memory Canton simulation implementation of the Settlement Backend Adapter.
 */
export class DemoSettlementAdapter implements ISettlementBackendAdapter {
  readonly mode = "demo" as const;
  private readonly store: typeof demoStore;

  constructor(customStore?: typeof demoStore) {
    this.store = customStore ?? demoStore;
  }

  async propose(terms: ProposalTerms): Promise<Composition> {
    return this.store.propose(terms);
  }

  async accept(compositionId: string, party: PartyId): Promise<Composition> {
    return this.store.accept(compositionId, party);
  }

  async allocate(
    compositionId: string,
    allocation: AllocationInput,
  ): Promise<{ composition: Composition; allocation: Allocation; commit: CommitRecord }> {
    return this.store.allocate(compositionId, allocation);
  }

  async withdrawLeg(
    compositionId: string,
    legId: string,
    caller: PartyId,
  ): Promise<{ composition: Composition; withdrawnAllocation: Allocation; commit: CommitRecord }> {
    return this.store.withdrawLeg(compositionId, legId, caller);
  }

  async settle(
    compositionId: string,
    withRegulator = true,
    caller?: PartyId,
  ): Promise<Composition> {
    return this.store.settle(compositionId, withRegulator, caller);
  }

  async cancel(compositionId: string, caller: PartyId): Promise<Composition> {
    return this.store.cancel(compositionId, caller);
  }

  async expire(
    compositionId: string,
    caller: PartyId = "Operator",
    simulatedNow?: Date,
  ): Promise<Composition> {
    return this.store.expire(compositionId, caller, simulatedNow);
  }

  async getReadiness(compositionId: string): Promise<ReadinessReport> {
    return this.store.getReadiness(compositionId);
  }

  async getPartyView(party: PartyId): Promise<ReturnType<typeof demoStore.partyView>> {
    return this.store.partyView(party);
  }
}

/**
 * Settlement Backend Adapter Factory: resolves adapter based on LEDGER_MODE.
 */
export function getSettlementBackendAdapter(customStore?: typeof demoStore): ISettlementBackendAdapter {
  return new DemoSettlementAdapter(customStore);
}
