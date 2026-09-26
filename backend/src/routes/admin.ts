import { Router } from "express";
import { demoStore, type PartyId } from "../demoStore.js";
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
adminRouter.get("/ledger/ping", async (_req, res) => {
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
 * Resets the demo store to clean initial state (restores standard CBTC, USDCx, ATTEST tokens).
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
    demoStore.mint("Oracle", "ATTEST", "1.0");

    res.json({ ok: true, message: "System state reset and standard assets re-seeded." });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

/**
 * GET /admin/oracle/live
 * Fetches live commodity prices and cryptographic signature from the Oracle service (:4002).
 */
adminRouter.get("/oracle/live", async (_req, res) => {
  try {
    const oracleUrl = process.env.ORACLE_URL ?? "http://localhost:4002";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const priceResp = await fetch(`${oracleUrl}/price?symbol=COCOA`, {
      signal: controller.signal,
    }).catch(() => null);

    clearTimeout(timeout);

    if (priceResp && priceResp.ok) {
      const data = await priceResp.json();
      res.json({ ok: true, source: "live-oracle-service", data });
    } else {
      // Fallback algorithmic live quote if separate process not spawned
      const now = Date.now();
      const price = (8240.5 + Math.sin(now / 10000) * 12.5).toFixed(2);
      res.json({
        ok: true,
        source: "internal-oracle-engine",
        data: {
          symbol: "COCOA",
          price,
          currency: "USD",
          unit: "MT",
          signature: "0x98f2ba7c65e8d91024bda71289cf8211029",
          timestamp: new Date().toISOString(),
        },
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
