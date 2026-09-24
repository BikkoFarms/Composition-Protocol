#!/usr/bin/env node
/**
 * Fetch an OIDC access token for the shared HackCanton DevNet participant.
 *
 * Usage:
 *   OIDC_CLIENT_ID=... OIDC_CLIENT_SECRET=... OIDC_USERNAME=... OIDC_PASSWORD=... \
 *     node scripts/oidc-token.mjs
 *
 * Prints the access_token to stdout (suitable for LEDGER_API_TOKEN=).
 */
const tokenUrl =
  process.env.OIDC_TOKEN_URL ??
  "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token";

const audience =
  process.env.OIDC_AUDIENCE ??
  "https://hackcanton-01.devnet.naas.noders.services";

const clientId = process.env.OIDC_CLIENT_ID;
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const username = process.env.OIDC_USERNAME;
const password = process.env.OIDC_PASSWORD;

if (!clientId || !username || !password) {
  console.error(
    "Set OIDC_CLIENT_ID, OIDC_USERNAME, OIDC_PASSWORD (and OIDC_CLIENT_SECRET if confidential client).",
  );
  process.exit(1);
}

const body = new URLSearchParams({
  grant_type: "password",
  client_id: clientId,
  username,
  password,
  audience,
});
if (clientSecret) body.set("client_secret", clientSecret);

const res = await fetch(tokenUrl, {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body,
});

if (!res.ok) {
  console.error(`OIDC token failed (${res.status}):`, await res.text());
  process.exit(1);
}

const json = await res.json();
if (!json.access_token) {
  console.error("No access_token in response", json);
  process.exit(1);
}

process.stdout.write(json.access_token);
