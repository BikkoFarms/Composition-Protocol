import { Router } from "express";
import { demoStore, type LegSpec, type PartyId } from "../demoStore.js";

export const compositionsRouter = Router();

compositionsRouter.get("/", (_req, res) => {
  res.json({
    compositions: [...demoStore.compositions.values()],
    governances: [...demoStore.governances.values()],
    metrics: demoStore.metrics,
  });
});

/** One-click pitch: propose → accept → settle → money shot. */
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

/** Metrics evidence: settle N compositions (default 50). */
compositionsRouter.post("/demo/load", (req, res) => {
  try {
    const count = Number((req.body as { count?: number })?.count ?? 50);
    if (!Number.isFinite(count) || count < 1 || count > 500) {
      res.status(400).json({ error: "count must be 1..500" });
      return;
    }
    const result = demoStore.runLoad(count);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

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

compositionsRouter.post("/governance/:id/approve", (req, res) => {
  try {
    const governor = (req.body as { governor: PartyId }).governor;
    const gov = demoStore.approveGovernance(req.params.id, governor);
    res.json(gov);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

compositionsRouter.post("/governance/:id/execute", (req, res) => {
  try {
    const composition = demoStore.executeGovernance(req.params.id);
    res.json(composition);
  } catch (e) {
    res.status(409).json({ error: (e as Error).message });
  }
});

compositionsRouter.get("/:id", (req, res) => {
  try {
    res.json(demoStore.require(req.params.id));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});

compositionsRouter.post("/:id/accept", (req, res) => {
  try {
    const acceptor = (req.body as { acceptor: PartyId }).acceptor;
    const composition = demoStore.accept(req.params.id, acceptor);
    res.json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

compositionsRouter.post("/:id/settle", (req, res) => {
  try {
    const withRegulator = (req.body as { withRegulator?: boolean })
      ?.withRegulator !== false;
    const composition = demoStore.settle(req.params.id, withRegulator);
    console.log(
      `[fiat-mock] settlement ${composition.receiptCid ?? composition.governanceCid} logged`,
    );
    res.json(composition);
  } catch (e) {
    res.status(409).json({
      error: (e as Error).message,
      atomic: true,
      halfState: false,
    });
  }
});
