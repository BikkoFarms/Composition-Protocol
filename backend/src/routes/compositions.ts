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
 * One-click pitch orchestration:
 * 1. Proposes 3-leg trade-finance deal (CBTC collateral, USDCx cash, Oracle ATTEST).
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
 * POST /compositions/:id/settle
 * Final settlement execution:
 * - Enforces single Daml transaction atomicity across all legs (R-ATOM-1).
 * - Emits SettlementReceipt with observer scoping for regulator (R-PRIV-2).
 * - Returns 409 Conflict with atomic: true on any leg failure (R-ATOM-2).
 */
compositionsRouter.post("/:id/settle", (req, res) => {
  try {
    const withRegulator = (req.body as { withRegulator?: boolean })
      ?.withRegulator !== false;
    const composition = demoStore.settle(req.params.id, withRegulator);
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

