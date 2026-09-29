import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";
import { ledgerFromEnv } from "../ledger.js";
import { liveMoneyShot, partiesFromEnv } from "../ledgerWorkflow.js";

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
 * In ledger mode with LEDGER_PARTY_* set, proxies live ACS for Bob/Regulator aliases.
 */
auditRouter.get("/view/:party", async (req, res) => {
  const party = req.params.party as PartyId;
  const ledger = ledgerFromEnv();
  const parties = partiesFromEnv();
  if (ledger && parties) {
    const map: Record<string, string> = {
      Bob: parties.bob,
      Regulator: parties.regulator,
      Alice: parties.alice,
      Oracle: parties.oracle,
      Operator: parties.operator,
    };
    const ledgerParty = map[party];
    if (ledgerParty) {
      try {
        const [tok, rec] = await Promise.all([
          ledger.queryActive(ledgerParty, "MockToken", "MockToken"),
          ledger.queryActive(ledgerParty, "Composition", "SettlementReceipt"),
        ]);
        const shot = await liveMoneyShot(ledger, ledgerParty, ledgerParty);
        res.json({
          ...shot.participant,
          party,
          ledgerParty,
          source: "ledger",
          raw: { tokens: tok, receipts: rec },
        });
        return;
      } catch (e) {
        res.status(502).json({ error: (e as Error).message, source: "ledger" });
        return;
      }
    }
  }
  if (!demoStore.listParties().includes(party)) {
    res.status(400).json({ error: `unknown party ${party}` });
    return;
  }
  res.json({ ...demoStore.partyView(party), source: "demo" });
});

/**
 * GET /audit/metrics
 * Returns global performance statistics, settlement success/revert rates, and live audit event stream.
 */
auditRouter.get("/metrics", (_req, res) => {
  res.json(demoStore.getMetrics());
});

/**
 * GET /audit/money-shot
 * Side-by-side verification payload for the pitch demo (R-PRIV-3):
 * Participant Bob vs Regulator — receipt present, visibleTokens: [] for observer.
 * Uses live per-party ACS when LEDGER_MODE=ledger + LEDGER_PARTY_BOB/REGULATOR set.
 */
auditRouter.get("/money-shot", async (_req, res) => {
  const ledger = ledgerFromEnv();
  const parties = partiesFromEnv();
  if (ledger && parties) {
    try {
      const live = await liveMoneyShot(ledger, parties.bob, parties.regulator);
      res.json(live);
      return;
    } catch (e) {
      res.status(502).json({
        error: (e as Error).message,
        hint: "Live ACS failed — check LEDGER_PARTY_* and package-name filters",
        source: "ledger",
      });
      return;
    }
  }

  const participant = demoStore.partyView("Bob");
  const observer = demoStore.partyView("Regulator");
  res.json({
    source: "demo",
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
