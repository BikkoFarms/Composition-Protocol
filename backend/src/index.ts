import cors from "cors";
import express from "express";
import { ledgerFromEnv } from "./ledger.js";
import { assetsRouter } from "./routes/assets.js";
import { compositionsRouter } from "./routes/compositions.js";
import { auditRouter } from "./routes/audit.js";

/**
 * Composition Protocol Backend API Gateway
 *
 * Provides a unified REST API layer interfacing with both:
 * 1. Live Canton JSON Ledger API v2 (when LEDGER_MODE=ledger and credentials configured)
 * 2. High-fidelity in-memory Daml ACS simulation (LocalNet demo store)
 *
 * Implements endpoints for Asset discovery, Multi-asset Composition lifecycle,
 * BitSafe Decentralized Governance, and Regulator Audit ACS views.
 */

const app = express();
const port = Number(process.env.PORT ?? 4000);

// Global middleware: permissive CORS for local Next.js frontend and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize Canton ledger client if environment variables or LEDGER_MODE are set
const ledger = ledgerFromEnv();
const mode = ledger ? "ledger" : "demo";

/**
 * Health check endpoint reporting active execution mode, ledger connectivity,
 * and Keycloak OIDC configuration status.
 */
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode,
    ledgerConfigured: Boolean(ledger),
    ledgerUrl: ledger ? ledger.getBaseUrl() : null,
    oidcConfigured: Boolean(
      process.env.LEDGER_API_TOKEN ||
        (process.env.OIDC_CLIENT_ID && process.env.OIDC_USERNAME),
    ),
    package: "composition-protocol",
  });
});

// Mount domain route handlers
app.use("/assets", assetsRouter);
app.use("/compositions", compositionsRouter);
app.use("/audit", auditRouter);

app.listen(port, () => {
  console.log(`Composition Protocol API on :${port} (mode=${mode})`);
  if (!ledger) {
    console.log(
      "LEDGER_API_URL unset — serving in-memory demo store. Point at Canton JSON API v2 for live ledger.",
    );
  }
});
