import cors from "cors";
import express from "express";
import { ledgerFromEnv } from "./ledger.js";
import { assetsRouter } from "./routes/assets.js";
import { compositionsRouter } from "./routes/compositions.js";
import { auditRouter } from "./routes/audit.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

const ledger = ledgerFromEnv();
const mode = ledger ? "ledger" : "demo";

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode,
    ledgerConfigured: Boolean(ledger),
    package: "composition-protocol",
  });
});

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
