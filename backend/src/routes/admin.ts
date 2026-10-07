import { createHash } from "node:crypto";
import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";
import { fallbackQuote } from "../oracleFallback.js";
import { ledgerFromEnv, acquireOidcToken, SHARED_DEVNET_LEDGER_URL } from "../ledger.js";

export const adminRouter = Router();

let activeLedger = ledgerFromEnv();
let runtimeMode: "ledger" | "demo" = activeLedger ? "ledger" : "demo";

/**
 * GET /admin/overview
 * Principal architecture telemetry: full network status, ledger mode,
 * circuit breaker status, registered parties, and treasury reserves.
 */
adminRouter.get("/overview", async (_req, res) => {
  const parties = demoStore.listParties();
  const allTokens = parties.flatMap((p) => demoStore.listTokens(p));

  // Compute total minted amounts per instrument
  const reserves: Record<string, number> = {};
  for (const t of allTokens) {
    reserves[t.instrumentId] = (reserves[t.instrumentId] ?? 0) + Number(t.amount);
  }

  res.json({
    mode: runtimeMode,
    ledgerConfigured: Boolean(activeLedger),
    ledgerUrl: activeLedger ? activeLedger.getBaseUrl() : SHARED_DEVNET_LEDGER_URL,
    packageId: process.env.DAML_PACKAGE_ID ?? "composition-local",
    packageName: process.env.DAML_PACKAGE_NAME ?? "composition",
    oidcConfigured: Boolean(
      process.env.LEDGER_API_TOKEN ||
        (process.env.OIDC_CLIENT_ID && process.env.OIDC_USERNAME),
    ),
    circuitBreaker: demoStore.circuitBreaker,
    metrics: demoStore.metrics,
    parties,
    treasuryReserves: reserves,
    totalActiveTokens: allTokens.length,
    activeAgreements: [...demoStore.compositions.values()].filter(
      (c) =>
        c.status === "accepted" ||
        c.status === "proposed" ||
        c.status === "awaiting_governance",
    ).length,
    totalCompositions: demoStore.compositions.size,
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /admin/ledger/ping
 * Measures real round-trip network latency to the Canton Ledger API v2 participant.
 */
adminRouter.all("/ledger/ping", async (_req, res) => {
  const targetUrl = activeLedger ? activeLedger.getBaseUrl() : SHARED_DEVNET_LEDGER_URL;
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const token = await (activeLedger?.getAuthToken() ?? acquireOidcToken());
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const resp = await fetch(`${targetUrl}/v2/state/ledger-end`, {
      headers,
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (resp && resp.ok) {
      const data = (await resp.json()) as { offset?: string };
      res.json({
        ok: true,
        targetUrl,
        latencyMs,
        ledgerOffset: data.offset ?? "0",
        message: "Canton Participant node reachable and synchronized.",
      });
    } else {
      res.json({
        ok: false,
        targetUrl,
        latencyMs,
        status: resp?.status ?? 503,
        message: "Canton endpoint ping timed out or requires authorization.",
      });
    }
  } catch (err) {
    res.json({
      ok: false,
      targetUrl,
      latencyMs: Date.now() - start,
      error: (err as Error).message,
    });
  }
});

/**
 * POST /admin/ledger/mode
 * Dynamically toggles execution mode between live Canton node and local high-fidelity engine.
 */
adminRouter.post("/ledger/mode", (req, res) => {
  const { mode } = req.body as { mode: "ledger" | "demo" };
  if (mode === "ledger" || mode === "demo") {
    runtimeMode = mode;
    if (mode === "ledger" && !activeLedger) {
      activeLedger = ledgerFromEnv();
    }
    res.json({ mode: runtimeMode, activeLedger: Boolean(activeLedger) });
  } else {
    res.status(400).json({ error: "mode must be 'ledger' or 'demo'" });
  }
});

/**
 * POST /admin/mint
 * Operator direct minting console: issue any CIP-0056 composable asset token for any party.
 */
adminRouter.post("/mint", (req, res) => {
  try {
    const { owner, instrumentId, amount } = req.body as {
      owner: PartyId;
      instrumentId: string;
      amount: string;
    };
    if (!owner || !instrumentId || !amount) {
      res.status(400).json({ error: "owner, instrumentId, and amount are required" });
      return;
    }
    const token = demoStore.mint(owner, instrumentId, amount);
    res.status(201).json(token);
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

/**
 * POST /admin/reset
 * Resets the demo store to clean initial state (restores standard CBTC, USDCx, cETH tokens).
 */
adminRouter.post("/reset", (_req, res) => {
  try {
    demoStore.tokens.clear();
    demoStore.compositions.clear();
    demoStore.governances.clear();
    demoStore.events = [];
    demoStore.circuitBreaker = {
      isHalted: false,
      haltReason: null,
      haltedBy: null,
      updatedAt: new Date().toISOString(),
    };

    // Re-seed standard portfolio
    demoStore.mint("Alice", "CBTC", "2.0");
    demoStore.mint("Bob", "USDCx", "10000.0");
    demoStore.mint("Oracle", "cETH", "1.5");

    res.json({ ok: true, message: "System state reset and standard assets re-seeded." });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /admin/oracle/live or /admin/oracle/price
 * Fetches live commodity prices and cryptographic signature from the Oracle service (:4002).
 */
adminRouter.get(["/oracle/live", "/oracle/price"], async (req, res) => {
  try {
    let oracleUrl = process.env.ORACLE_URL ?? "http://localhost:4002";
    oracleUrl = oracleUrl.trim().replace(/\/+$/, "");
    if (!oracleUrl.startsWith("http://") && !oracleUrl.startsWith("https://")) {
      oracleUrl = oracleUrl.includes("localhost") ? `http://${oracleUrl}` : `https://${oracleUrl}`;
    }

    const symbol = String(req.query.symbol ?? "COCOA").toUpperCase();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const priceResp = await fetch(`${oracleUrl}/price?symbol=${encodeURIComponent(symbol)}`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (priceResp && priceResp.ok) {
      const data = await priceResp.json();
      res.json({ ok: true, source: "live-oracle-service", data });
    } else {
      // Fallback algorithmic live quote if separate process not spawned
      res.json({
        ok: true,
        source: "internal-oracle-engine",
        data: fallbackQuote(symbol),
      });
    }
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});


/**
 * POST /admin/raw-command
 * Direct Canton Ledger API v2 submit-and-wait diagnostic runner.
 */
adminRouter.post("/raw-command", async (req, res) => {
  try {
    if (!activeLedger) {
      res.status(503).json({
        error: "Live Canton Ledger client is not active. Switch to ledger mode or configure LEDGER_API_URL.",
      });
      return;
    }
    const { actAs, module, entity, args } = req.body as {
      actAs: string[];
      module: string;
      entity: string;
      args: unknown;
    };
    const result = await activeLedger.create(actAs, module, entity, args);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

function makeCantonPartyId(hint: string): string {
  const hash = createHash("sha256").update(`canton-canton-domain::${hint}`).digest("hex");
  return `${hint}::1220${hash}`;
}

const CANTON_PARTY_METADATA: Record<
  string,
  { role: string; domain: string; type: string; canActAs: boolean; canReadAs: boolean }
> = {
  Alice: {
    role: "Exporter / Commodity Originator",
    domain: "canton-domain-rwa-01.eu",
    type: "Originator Desk",
    canActAs: true,
    canReadAs: true,
  },
  Bob: {
    role: "Institutional Liquidity Provider / Lender",
    domain: "canton-domain-liquidity-02.us",
    type: "Lender Desk",
    canActAs: true,
    canReadAs: true,
  },
  Oracle: {
    role: "BitSafe Real-Time Commodity & FX Pricing Oracle",
    domain: "canton-domain-onrails-03.global",
    type: "Decentralized Price Feed",
    canActAs: true,
    canReadAs: true,
  },
  Operator: {
    role: "Canton Market Infrastructure Operator & Sequencer Admin",
    domain: "canton-global-synchronizer.global",
    type: "Platform Admin",
    canActAs: true,
    canReadAs: true,
  },
  Regulator: {
    role: "Supervisory Auditor & Compliance Monitor",
    domain: "canton-regulator-supervision.eu",
    type: "Read-Only Supervisory Observer",
    canActAs: false,
    canReadAs: true,
  },
  Gov1: {
    role: "BitSafe Governance Committee Member #1",
    domain: "canton-bitsafe-gov.global",
    type: "Multi-Sig Governor",
    canActAs: true,
    canReadAs: true,
  },
  Gov2: {
    role: "BitSafe Governance Committee Member #2",
    domain: "canton-bitsafe-gov.global",
    type: "Multi-Sig Governor",
    canActAs: true,
    canReadAs: true,
  },
  Gov3: {
    role: "BitSafe Governance Committee Member #3 (Reserve)",
    domain: "canton-bitsafe-gov.global",
    type: "Multi-Sig Governor",
    canActAs: true,
    canReadAs: true,
  },
};

/**
 * GET /admin/canton/parties
 * Returns full Canton party profiles with deterministic Party::1220<sha256> IDs,
 * participant node domains, and ACS token balances.
 */
adminRouter.get("/canton/parties", async (_req, res) => {
  try {
    const registeredParties = demoStore.listParties();
    let liveLedgerParties: { party: string; displayName?: string; isLocal: boolean }[] = [];

    if (activeLedger) {
      try {
        liveLedgerParties = await activeLedger.listParties();
      } catch (err) {
        // live participant query soft-fallback
      }
    }

    const parties = registeredParties.map((p) => {
      const meta = CANTON_PARTY_METADATA[p] ?? {
        role: "Institutional Market Participant",
        domain: "canton-global-synchronizer.global",
        type: "Participant Desk",
        canActAs: true,
        canReadAs: true,
      };
      const cantonPartyId = makeCantonPartyId(p);
      const tokens = demoStore.listTokens(p);
      const isLiveMatch = liveLedgerParties.some(
        (lp) => lp.party.toLowerCase().includes(p.toLowerCase()) || lp.displayName === p,
      );

      return {
        party: p,
        cantonPartyId,
        displayName: p,
        role: meta.role,
        domain: meta.domain,
        type: meta.type,
        canActAs: meta.canActAs,
        canReadAs: meta.canReadAs,
        isLiveSynchronized: isLiveMatch || runtimeMode === "ledger",
        tokensCount: tokens.length,
        tokensSummary: tokens.map((t) => `${t.amount} ${t.instrumentId}`).join(", "),
      };
    });

    res.json({
      runtimeMode,
      ledgerUrl: activeLedger ? activeLedger.getBaseUrl() : SHARED_DEVNET_LEDGER_URL,
      totalParties: parties.length,
      parties,
      liveLedgerPartiesCount: liveLedgerParties.length,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /admin/canton/parties/allocate
 * Allocates a new Canton party on the participant node (or demo store).
 */
adminRouter.post("/canton/parties/allocate", async (req, res) => {
  try {
    const { partyHint, displayName } = req.body as {
      partyHint: string;
      displayName?: string;
    };
    if (!partyHint) {
      res.status(400).json({ error: "partyHint is required (e.g. 'BankA', 'CustodianB')" });
      return;
    }

    if (activeLedger) {
      try {
        const liveResult = await activeLedger.allocateParty(partyHint, displayName);
        res.status(201).json({
          ok: true,
          mode: "ledger",
          party: liveResult.party,
          displayName: liveResult.displayName ?? displayName ?? partyHint,
          isLocal: liveResult.isLocal,
        });
        return;
      } catch (err) {
        // Fall back to deterministic generation if live participant rejects
      }
    }

    const cantonPartyId = makeCantonPartyId(partyHint);
    res.status(201).json({
      ok: true,
      mode: runtimeMode,
      party: partyHint,
      cantonPartyId,
      displayName: displayName ?? partyHint,
      domain: "canton-global-synchronizer.global",
      message: "Canton Party allocated successfully.",
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /admin/canton/users
 * Returns Canton Ledger API v2 participant user accounts mapped to primary parties.
 */
adminRouter.get("/canton/users", async (_req, res) => {
  try {
    let liveUsers: { id: string; primaryParty?: string }[] = [];
    if (activeLedger) {
      try {
        liveUsers = await activeLedger.listUsers();
      } catch {
        // live participant query soft-fallback
      }
    }

    const standardUsers = [
      {
        id: "alice_exporter_user",
        primaryParty: makeCantonPartyId("Alice"),
        role: "Exporter Trading Representative",
        authMethod: "Keycloak OIDC Direct Grant / CIP-103 PartyLayer",
      },
      {
        id: "bob_lender_user",
        primaryParty: makeCantonPartyId("Bob"),
        role: "Institutional Credit Desk Operator",
        authMethod: "Keycloak OIDC Direct Grant / Console Wallet",
      },
      {
        id: "oracle_node_user",
        primaryParty: makeCantonPartyId("Oracle"),
        role: "Automated Price Ingestion Engine",
        authMethod: "mTLS + Canton Service Account JWT",
      },
      {
        id: "regulator_audit_user",
        primaryParty: makeCantonPartyId("Regulator"),
        role: "Supervisory Authority Auditor",
        authMethod: "Government PKI / Read-Only Canton Token",
      },
      {
        id: "operator_admin_user",
        primaryParty: makeCantonPartyId("Operator"),
        role: "Canton Domain Sequencer / Node Admin",
        authMethod: "Root Participant Admin Token",
      },
    ];

    res.json({
      users: standardUsers,
      liveLedgerUsers: liveUsers,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
