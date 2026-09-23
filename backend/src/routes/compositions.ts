import { Router } from "express";
import { demoStore, type LegSpec, type PartyId } from "../demoStore.js";

export const compositionsRouter = Router();

compositionsRouter.get("/", (_req, res) => {
  res.json({
    compositions: [...demoStore.compositions.values()],
    metrics: demoStore.metrics,
  });
});

compositionsRouter.get("/:id", (req, res) => {
  try {
    res.json(demoStore.require(req.params.id));
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
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
    };
    const composition = demoStore.propose(body);
    res.status(201).json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
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
    // Mock fiat settlement boundary
    console.log(
      `[fiat-mock] settlement ${composition.receiptCid} logged for off-rail reconciliation`,
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

/** Convenience: seed a standard 3-leg trade-finance composition from Alice. */
compositionsRouter.post("/demo/trade-finance", (req, res) => {
  try {
    const forceFail = Boolean((req.body as { forceFail?: boolean })?.forceFail);
    const aliceTokens = demoStore.listTokens("Alice");
    const bobTokens = demoStore.listTokens("Bob");
    const oracleTokens = demoStore.listTokens("Oracle");
    const collateral =
      aliceTokens.find((t) => t.instrumentId === "CBTC") ??
      demoStore.mint("Alice", "CBTC", "2.0");
    const cash =
      bobTokens.find((t) => t.instrumentId === "USDCx") ??
      demoStore.mint("Bob", "USDCx", "10000.0");
    const attest =
      oracleTokens.find((t) => t.instrumentId === "ATTEST") ??
      demoStore.mint("Oracle", "ATTEST", "1.0");

    const composition = demoStore.propose({
      proposer: "Alice",
      counterparties: ["Bob", "Oracle"],
      description:
        "African cocoa export — collateral + USDCx working capital + grade attestation",
      forceFail,
      legs: [
        {
          legId: "collateral",
          instrumentId: "CBTC",
          amount: collateral.amount,
          provider: "Alice",
          receiver: "Bob",
          assetCid: collateral.contractId,
        },
        {
          legId: "cash",
          instrumentId: "USDCx",
          amount: cash.amount,
          provider: "Bob",
          receiver: "Alice",
          assetCid: cash.contractId,
        },
        {
          legId: "attestation",
          instrumentId: "ATTEST",
          amount: attest.amount,
          provider: "Oracle",
          receiver: "Bob",
          assetCid: attest.contractId,
        },
      ],
    });
    res.status(201).json(composition);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
