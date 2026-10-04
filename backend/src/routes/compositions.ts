import { Router } from "express";
import { demoStore, type LegSpec, type PartyId } from "../demoStore.js";

export const compositionsRouter = Router();

/**
 * GET /compositions
 * Returns all active compositions, governed settlement instances, and global protocol metrics.
 */
compositionsRouter.get("/", (_req, res) => {
  res.json({
    compositions: [...demoStore.compositions.values()],
    governances: [...demoStore.governances.values()],
    metrics: demoStore.metrics,
  });
});

/**
 * POST /compositions/demo/run-full
 * One-click orchestration (allocate-all + settle; secondary to /demo matching path):
 * 1. Proposes 3-leg trade-finance deal (CBTC collateral, USDCx cash, Oracle cETH).
 * 2. Collects co-signatures from all counterparties (AcceptanceTracker).
 * 3. Executes atomic settlement choice (R-ATOM-1) or forced revert (R-ATOM-2).
 * 4. Assembles side-by-side observer vs participant visibility payload.
 */
compositionsRouter.post("/demo/run-full", (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      forceFail?: boolean;
      requireGovernance?: boolean;
    };
    const result = demoStore.runFullDemo(body);
    const status = result.error ? 409 : 200;
    res.status(status).json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/demo/load
 * High-throughput settlement benchmarking for HackCanton Metrics evidence:
 * Executes N (default 50) atomic compositions on-chain and returns aggregated statistics.
 */
compositionsRouter.post("/demo/load", (req, res) => {
  try {
    const count = Number((req.body as { count?: number })?.count ?? 50);
    if (!Number.isFinite(count) || count < 1 || count > 500) {
      res.status(400).json({ error: "count must be between 1 and 500" });
      return;
    }
    const result = demoStore.runLoad(count);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/demo/trade-finance
 * Factory helper: constructs a pre-configured 3-leg African trade finance composition.
 */
compositionsRouter.post("/demo/trade-finance", (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      forceFail?: boolean;
      requireGovernance?: boolean;
      expiresAt?: string;
    };
    const composition = demoStore.proposeTradeFinance(body);
    res.status(201).json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/propose
 * Core lifecycle endpoint: creates a custom multi-leg CompositionProposal contract.
 */
compositionsRouter.post("/propose", (req, res) => {
  try {
    const body = req.body as {
      proposer: PartyId;
      counterparties: PartyId[];
      legs: LegSpec[];
      description: string;
      forceFail?: boolean;
      requireGovernance?: boolean;
    };
    const composition = demoStore.propose(body);
    res.status(201).json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/governance/open
 * BitSafe Decentralization challenge: wraps an accepted composition in an M-of-N governed settlement gate.
 */
compositionsRouter.post("/governance/open", (req, res) => {
  try {
    const body = req.body as {
      compositionId: string;
      governors?: PartyId[];
      threshold?: number;
    };
    const gov = demoStore.openGovernance(
      body.compositionId,
      body.governors ?? ["Gov1", "Gov2", "Gov3"],
      body.threshold ?? 2,
    );
    res.status(201).json(gov);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/governance/:id/approve
 * Records a governor's signature towards the M-of-N threshold.
 */
compositionsRouter.post("/governance/:id/approve", (req, res) => {
  try {
    const governor = (req.body as { governor: PartyId }).governor;
    const gov = demoStore.approveGovernance(req.params.id, governor);
    res.json(gov);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/governance/:id/execute
 * Executes a governed settlement:
 * - Throws 409 Conflict if approvals < threshold (R-GOV-1).
 * - Executes atomic settlement and returns 200 OK once threshold is satisfied (R-GOV-2).
 */
compositionsRouter.post("/governance/:id/execute", (req, res) => {
  try {
    const composition = demoStore.executeGovernance(req.params.id);
    res.json(composition);
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

/**
 * GET /compositions/:id
 * Fetches current composition state by ID.
 */
compositionsRouter.get("/:id", (req, res) => {
  try {
    res.json(demoStore.require(req.params.id));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/accept
 * Records counterparty acceptance; transitions tracker from proposed -> partially_accepted -> accepted.
 */
compositionsRouter.post("/:id/accept", (req, res) => {
  try {
    const acceptor = (req.body as { acceptor: PartyId }).acceptor;
    const composition = demoStore.accept(req.params.id, acceptor);
    res.json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/demo/open-desk
 * Judge path step 1: propose 3-leg trade-finance + accept all counterparties.
 * Returns agreement ready for per-leg Allocate (not yet settled).
 */
compositionsRouter.post("/demo/open-desk", (req, res) => {
  try {
    const body = (req.body ?? {}) as { forceFail?: boolean };
    const composition = demoStore.proposeTradeFinance({
      forceFail: body.forceFail,
    });
    for (const p of composition.counterparties) {
      demoStore.accept(composition.id, p);
    }
    res.status(201).json({
      composition: demoStore.require(composition.id),
      legs: demoStore.require(composition.id).legs,
      commits: demoStore.require(composition.id).commits,
      next: "Allocate each leg — matching parties, amount, instrument, reference, deadline",
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/allocate
 * Post one LegAllocation; field-by-field match against agreed LegSpec (CIP-56 coordination).
 * On mismatch returns 409 with verbatim allocation match failed: … reason (no state change).
 */
compositionsRouter.post("/:id/allocate", (req, res) => {
  try {
    const body = req.body as {
      legId: string;
      instrumentId: string;
      amount: string;
      provider: PartyId;
      receiver: PartyId;
      assetCid: string;
      reference: string;
      deadline: string;
      allocator?: PartyId;
    };
    const result = demoStore.allocate(req.params.id, body);
    res.status(201).json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const isMatch = msg.startsWith("allocation match failed");
    res.status(isMatch ? 409 : 400).json({
      error: msg,
      rejected: isMatch,
      halfState: false,
    });
  }
});

/**
 * POST /compositions/:id/allocate-all
 * Allocates all remaining unallocated legs using agreed LegSpec parameters.
 */
compositionsRouter.post("/:id/allocate-all", (req, res) => {
  try {
    const composition = demoStore.allocateAll(req.params.id);
    res.json({ ok: true, composition });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * GET /compositions/:id/readiness
 * FR-5 & FR-11: Shared readiness view showing trade-level readiness, allocated vs pending legs,
 * and outstanding parties.
 */
compositionsRouter.get("/:id/readiness", (req, res) => {
  try {
    const readiness = demoStore.getReadiness(req.params.id);
    res.json(readiness);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/settle
 * Final settlement execution:
 * - Enforces single Daml transaction atomicity across all legs (R-ATOM-1).
 * - Emits SettlementReceipt with observer scoping for regulator (R-PRIV-2).
 * - Returns 409 Conflict with atomic: true on any leg failure (R-ATOM-2).
 */
compositionsRouter.post("/:id/settle", (req, res) => {
  try {
    const body = (req.body ?? {}) as { withRegulator?: boolean; caller?: PartyId };
    const withRegulator = body.withRegulator !== false;
    const composition = demoStore.settle(req.params.id, withRegulator, body.caller);
    console.log(
      `[settlement] deal ${composition.id} settled; receipt: ${composition.receiptCid}`,
    );
    res.json(composition);
  } catch (e) {
    // Return structured 409 Conflict asserting atomicity
    res.status(409).json({
      error: (e as Error).message,
      atomic: true,
      halfState: false,
    });
  }
});

/**
 * POST /compositions/:id/withdraw-leg
 * FR-10: Withdraw a previously posted leg allocation before settlement.
 * Releases the allocated leg back to the provider and transitions status back to allocating.
 */
compositionsRouter.post("/:id/withdraw-leg", (req, res) => {
  try {
    const { legId, caller } = (req.body ?? {}) as { legId: string; caller: PartyId };
    if (!legId || !caller) {
      res.status(400).json({ error: "legId and caller are required" });
      return;
    }
    const result = demoStore.withdrawLeg(req.params.id, legId, caller);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/cancel
 * Proposer cancellation choice: clean withdrawal before settlement.
 */
compositionsRouter.post("/:id/cancel", (req, res) => {
  try {
    const caller = ((req.body as { caller?: PartyId })?.caller ?? "Alice") as PartyId;
    const c = demoStore.cancel(req.params.id, caller);
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/expire
 * Resolves a stalled or timed-out proposal via the expiration path.
 */
compositionsRouter.post("/:id/expire", (req, res) => {
  try {
    const body = (req.body ?? {}) as { caller?: PartyId; force?: boolean };
    const caller = (body.caller ?? "Operator") as PartyId;
    const existing = demoStore.compositions.get(req.params.id);
    const simulatedNow =
      body.force && existing?.expiresAt
        ? new Date(new Date(existing.expiresAt).getTime() + 1000)
        : undefined;
    const c = demoStore.expire(req.params.id, caller, simulatedNow);
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/:id/reject
 * Counterparty rejection path: cleanly rejects a proposal.
 */
compositionsRouter.post("/:id/reject", (req, res) => {
  try {
    const { rejector, reason } = req.body as { rejector: PartyId; reason: string };
    const c = demoStore.reject(req.params.id, rejector, reason ?? "Proposal rejected by counterparty");
    res.json(c);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * GET /compositions/circuit-breaker/state
 * Returns active emergency circuit breaker state.
 */
compositionsRouter.get("/circuit-breaker/state", (_req, res) => {
  res.json(demoStore.circuitBreaker);
});

/**
 * POST /compositions/circuit-breaker/toggle
 * Institutional emergency halt/resume trigger.
 */
compositionsRouter.post("/circuit-breaker/toggle", (req, res) => {
  try {
    const body = (req.body ?? {}) as { caller?: PartyId; reason?: string };
    const state = demoStore.toggleCircuitBreaker(body.caller ?? "Operator", body.reason);
    res.json(state);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/governance/:id/veto
 * Institutional Emergency Veto: named governor aborts open governed deal.
 */
compositionsRouter.post("/governance/:id/veto", (req, res) => {
  try {
    const { governor, reason } = req.body as { governor: PartyId; reason: string };
    const gov = demoStore.vetoGovernance(req.params.id, governor, reason ?? "Governance veto executed");
    res.json(gov);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /compositions/ledger/e2e
 * Live DevNet path: mint → propose → accept×N → finalize → allocate → settle → ACS receipt.
 * Requires LEDGER_MODE=ledger, DAML_PACKAGE_ID, OIDC/token, and LEDGER_PARTY_*.
 */
compositionsRouter.post("/ledger/e2e", async (_req, res) => {
  const { ledgerFromEnv } = await import("../ledger.js");
  const { partiesFromEnv, runLedgerE2E } = await import("../ledgerWorkflow.js");
  const ledger = ledgerFromEnv();
  const parties = partiesFromEnv();
  if (!ledger) {
    res.status(503).json({
      error: "Ledger not configured",
      hint: "Set LEDGER_MODE=ledger and LEDGER_API_URL / OIDC_* — see docs/DEVNET.md",
    });
    return;
  }
  if (!parties) {
    res.status(503).json({
      error: "LEDGER_PARTY_* not set",
      required: [
        "LEDGER_PARTY_OPERATOR",
        "LEDGER_PARTY_ALICE",
        "LEDGER_PARTY_BOB",
        "LEDGER_PARTY_ORACLE",
        "LEDGER_PARTY_REGULATOR",
      ],
    });
    return;
  }
  try {
    const result = await runLedgerE2E(ledger, parties);
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

