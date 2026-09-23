import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";

export const assetsRouter = Router();

assetsRouter.get("/", (req, res) => {
  const party = (req.query.party as PartyId) || "Alice";
  res.json({ tokens: demoStore.listTokens(party) });
});

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
