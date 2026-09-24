import cors from "cors";
import express from "express";
import { ledgerFromEnv, type LedgerClient } from "./ledger.js";
import { fetchAccessToken, oidcFromEnv } from "./oidc.js";
import { assetsRouter } from "./routes/assets.js";
import { compositionsRouter } from "./routes/compositions.js";
import { auditRouter } from "./routes/audit.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

let ledger: LedgerClient | null = ledgerFromEnv();
const oidc = oidcFromEnv();

async function refreshLedgerToken() {
  if (!oidc || !process.env.LEDGER_API_URL) return;
  try {
    const token = await fetchAccessToken(oidc);
    process.env.LEDGER_API_TOKEN = token;
    ledger = ledgerFromEnv();
  } catch (e) {
    console.warn("[oidc] token refresh failed:", (e as Error).message);
  }
}

app.get("/health", async (_req, res) => {
  let ledgerReachable: boolean | null = null;
  if (ledger) {
    try {
      await ledger.ledgerEnd();
      ledgerReachable = true;
    } catch {
      ledgerReachable = false;
    }
  }
  res.json({
    ok: true,
    mode: ledger ? "ledger" : "demo",
    ledgerConfigured: Boolean(ledger),
    ledgerReachable,
    ledgerUrl: ledger ? ledger.getBaseUrl() : null,
    oidcConfigured: Boolean(oidc),
    package: "composition-protocol",
    design: "lattice",
  });
});

app.post("/admin/refresh-token", async (_req, res) => {
  if (!oidc) {
    res.status(400).json({ error: "OIDC_* env not configured" });
    return;
  }
  try {
    await refreshLedgerToken();
    res.json({ ok: true, ledgerConfigured: Boolean(ledger) });
  } catch (e) {
    res.status(502).json({ error: (e as Error).message });
  }
});

app.use("/assets", assetsRouter);
app.use("/compositions", compositionsRouter);
app.use("/audit", auditRouter);

app.listen(port, async () => {
  console.log(
    `Composition Protocol API on :${port} (mode=${ledger ? "ledger" : "demo"})`,
  );
  if (!ledger) {
    console.log(
      "LEDGER_API_URL unset — demo store. See docs/DEVNET.md for Canton wiring.",
    );
  }
  if (oidc && process.env.LEDGER_API_URL && !process.env.LEDGER_API_TOKEN) {
    await refreshLedgerToken();
  }
});
