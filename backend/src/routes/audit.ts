import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";

export const auditRouter = Router();

auditRouter.get("/parties", (_req, res) => {
  res.json({ parties: demoStore.listParties() });
});

auditRouter.get("/view/:party", (req, res) => {
  const party = req.params.party as PartyId;
  if (!demoStore.listParties().includes(party)) {
    res.status(400).json({ error: `unknown party ${party}` });
    return;
  }
  res.json(demoStore.partyView(party));
});

auditRouter.get("/metrics", (_req, res) => {
  res.json(demoStore.metrics);
});

/** Side-by-side money-shot payload for the pitch demo. */
auditRouter.get("/money-shot", (_req, res) => {
  const participant = demoStore.partyView("Bob");
  const observer = demoStore.partyView("Regulator");
  res.json({
    participant: {
      party: participant.party,
      visibleTokens: participant.visibleTokens,
      settlementReceipts: participant.settlementReceipts,
    },
    observer: {
      party: observer.party,
      visibleTokens: observer.visibleTokens,
      settlementReceipts: observer.settlementReceipts,
      proof: {
        visibleTokensEmpty: observer.visibleTokens.length === 0,
        receiptPresent: observer.settlementReceipts.length > 0,
        test: "testAuditorCannotSeeLegs",
      },
    },
  });
});
