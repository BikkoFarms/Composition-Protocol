import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";

export const auditRouter = Router();

/**
 * GET /audit/parties
 * Returns the list of all recognized parties in the Canton simulation/ledger.
 */
auditRouter.get("/parties", (_req, res) => {
  res.json({ parties: demoStore.listParties() });
});

/**
 * GET /audit/view/:party
 * Queries the Active Contract Set (ACS) for a specific party.
 * Enforces R-PRIV: Each party only receives contracts where it is a signatory or observer.
 */
auditRouter.get("/view/:party", (req, res) => {
  const party = req.params.party as PartyId;
  if (!demoStore.listParties().includes(party)) {
    res.status(400).json({ error: `unknown party ${party}` });
    return;
  }
  res.json(demoStore.partyView(party));
});

/**
 * GET /audit/metrics
 * Returns global performance statistics, settlement success/revert rates, and live audit event stream.
 */
auditRouter.get("/metrics", (_req, res) => {
  res.json(demoStore.metrics);
});

/**
 * GET /audit/money-shot
 * Side-by-side verification payload for the pitch demo (R-PRIV-3):
 * Directly compares Participant Bob's view against Regulator's view.
 * Proves that regulator ACS contains SettlementReceipt but visibleTokens: [].
 */
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

