#!/usr/bin/env node
/**
 * DevNet E2E: OIDC token → ledger-end → optional full settle via backend helper.
 * Usage (from repo root, with backend/.env loaded or env exported):
 *   node scripts/e2e-devnet.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, "backend/.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const LEDGER =
  process.env.LEDGER_API_URL ||
  "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services";
const TOKEN_URL =
  process.env.OIDC_TOKEN_URL ||
  "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token";
const AUDIENCE =
  process.env.OIDC_AUDIENCE || "https://hackcanton-01.devnet.naas.noders.services";

async function getToken() {
  if (process.env.LEDGER_API_TOKEN) return process.env.LEDGER_API_TOKEN;
  const { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_USERNAME, OIDC_PASSWORD } =
    process.env;
  if (!OIDC_CLIENT_ID || !OIDC_USERNAME || !OIDC_PASSWORD) {
    return null;
  }
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: OIDC_CLIENT_ID,
    username: OIDC_USERNAME,
    password: OIDC_PASSWORD,
    audience: AUDIENCE,
  });
  if (OIDC_CLIENT_SECRET) body.set("client_secret", OIDC_CLIENT_SECRET);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`OIDC ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

async function main() {
  console.log("DevNet ledger:", LEDGER);
  let token;
  try {
    token = await getToken();
  } catch (e) {
    console.error("Token exchange FAILED:", e.message);
    process.exit(1);
  }
  if (!token) {
    console.error(
      "No credentials: set LEDGER_API_TOKEN or OIDC_CLIENT_ID/USERNAME/PASSWORD in backend/.env",
    );
    console.error("Public node is reachable for auth once credentials are supplied.");
    process.exit(2);
  }
  console.log("Token exchange: OK");

  const endRes = await fetch(`${LEDGER}/v2/state/ledger-end`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!endRes.ok) {
    console.error("ledger-end FAILED:", endRes.status, await endRes.text());
    process.exit(1);
  }
  const end = await endRes.json();
  console.log("ledger-end OK:", end);

  const api = process.env.BACKEND_URL || "http://localhost:4000";
  try {
    const health = await fetch(`${api}/health`).then((r) => r.json());
    console.log("backend /health:", health);
  } catch {
    console.warn("backend not running — start with LEDGER_MODE=ledger to run full E2E");
    process.exit(0);
  }

  const e2e = await fetch(`${api}/compositions/ledger/e2e`, { method: "POST" });
  const body = await e2e.json();
  if (!e2e.ok) {
    console.error("E2E FAILED:", body);
    process.exit(1);
  }
  console.log("E2E OK");
  console.log(JSON.stringify(body, null, 2));
  console.log("Public participant:", LEDGER);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
