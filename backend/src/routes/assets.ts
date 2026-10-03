import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";

export const assetsRouter = Router();

/**
 * GET /assets?party=:party
 * Queries token holdings for a given Canton participant or observer (defaults to "Alice").
 * Enforces Canton sub-transaction privacy: only tokens where the party is owner or issuer are returned.
 */
assetsRouter.get("/", (req, res) => {
  const party = (req.query.party as PartyId) || "Alice";
  res.json({ tokens: demoStore.listTokens(party) });
});

/**
 * POST /assets/mint
 * Simulates minting of CIP-0056 compliant composable assets (e.g., CBTC, USDCx, cETH).
 * Creates a token contract owned by the specified party with positive decimal amount.
 */
assetsRouter.post("/mint", (req, res) => {
  try {
    const { owner, instrumentId, amount } = req.body as {
      owner: PartyId;
      instrumentId: string;
      amount: string;
    };
    const token = demoStore.mint(owner, instrumentId, amount);
    res.status(201).json(token);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /assets/issue
 * FR-8: Issues demo assets as CIP-56 holdings (tokenized asset, payment token, sponsor token).
 */
assetsRouter.post("/issue", (req, res) => {
  try {
    const body = (req.body ?? {}) as {
      tokenizedAssetOwner?: PartyId;
      tokenizedAssetInstrument?: string;
      tokenizedAssetAmount?: string;
      paymentTokenOwner?: PartyId;
      paymentTokenInstrument?: string;
      paymentTokenAmount?: string;
    };
    const tAsset = demoStore.mint(
      body.tokenizedAssetOwner ?? "Alice",
      body.tokenizedAssetInstrument ?? "CBTC",
      body.tokenizedAssetAmount ?? "2.0",
    );
    const pToken = demoStore.mint(
      body.paymentTokenOwner ?? "Bob",
      body.paymentTokenInstrument ?? "USDCx",
      body.paymentTokenAmount ?? "10000.0",
    );
    const sponsorToken = demoStore.mint("Oracle", "cETH", "1.5");
    res.status(201).json({
      status: "issued",
      standard: "CIP-0056",
      holdings: [tAsset, pToken, sponsorToken],
    });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
