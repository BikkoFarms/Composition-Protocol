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
 * Simulates minting of CIP-0056 compliant composable assets (e.g., CBTC, USDCx, ATTEST).
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
