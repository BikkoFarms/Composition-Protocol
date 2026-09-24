/**
 * Optional OIDC client-credentials / password grant helper used by /health
 * and scripts/oidc-token.mjs. Never logs secrets.
 */
export type OidcConfig = {
  tokenUrl: string;
  clientId: string;
  clientSecret?: string;
  username?: string;
  password?: string;
  audience?: string;
};

export function oidcFromEnv(): OidcConfig | null {
  const clientId = process.env.OIDC_CLIENT_ID;
  if (!clientId) return null;
  return {
    tokenUrl:
      process.env.OIDC_TOKEN_URL ??
      "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token",
    clientId,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    username: process.env.OIDC_USERNAME,
    password: process.env.OIDC_PASSWORD,
    audience:
      process.env.OIDC_AUDIENCE ??
      "https://hackcanton-01.devnet.naas.noders.services",
  };
}

export async function fetchAccessToken(cfg: OidcConfig): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    audience: cfg.audience ?? "",
  });
  if (cfg.username && cfg.password) {
    body.set("grant_type", "password");
    body.set("username", cfg.username);
    body.set("password", cfg.password);
  } else {
    body.set("grant_type", "client_credentials");
  }
  if (cfg.clientSecret) body.set("client_secret", cfg.clientSecret);

  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`OIDC token failed (${res.status})`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("OIDC response missing access_token");
  return json.access_token;
}
