/**
 * Canton JSON Ledger API v2 client.
 * Encoding: Decimal as JSON string; Date as YYYY-MM-DD; Optional as value|null.
 * Commands use package-id templateIds; ACS queries use package-name filters.
 */

export const SHARED_DEVNET_LEDGER_URL =
  "https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services";

export const SHARED_DEVNET_TOKEN_URL =
  "https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token";

export const SHARED_DEVNET_AUDIENCE =
  "https://hackcanton-01.devnet.naas.noders.services";

export type OidcConfig = {
  tokenUrl?: string;
  audience?: string;
  clientId?: string;
  clientSecret?: string;
  username?: string;
  password?: string;
};

export type LedgerConfig = {
  baseUrl: string;
  token?: string;
  oidc?: OidcConfig;
  packageId: string;
  packageName: string;
};

export type DisclosedContract = {
  templateId: {
    packageId: string;
    moduleName: string;
    entityName: string;
  };
  contractId: string;
  createdEventBlob: string;
};

type CachedToken = {
  token: string;
  expiresAt: number;
};

let cachedOidcToken: CachedToken | null = null;

/**
 * Fetch or refresh an OIDC access token for Canton Ledger API v2.
 */
export async function acquireOidcToken(
  cfg: OidcConfig = {},
): Promise<string | null> {
  const tokenUrl = cfg.tokenUrl ?? process.env.OIDC_TOKEN_URL ?? SHARED_DEVNET_TOKEN_URL;
  const audience = cfg.audience ?? process.env.OIDC_AUDIENCE ?? SHARED_DEVNET_AUDIENCE;
  const clientId = cfg.clientId ?? process.env.OIDC_CLIENT_ID;
  const clientSecret = cfg.clientSecret ?? process.env.OIDC_CLIENT_SECRET;
  const username = cfg.username ?? process.env.OIDC_USERNAME;
  const password = cfg.password ?? process.env.OIDC_PASSWORD;

  if (!clientId || !username || !password) {
    return null;
  }

  // Return cached token if valid for at least another 30 seconds
  const now = Date.now();
  if (cachedOidcToken && cachedOidcToken.expiresAt > now + 30_000) {
    return cachedOidcToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: clientId,
    username,
    password,
    audience,
  });
  if (clientSecret) body.set("client_secret", clientSecret);

  try {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[ledger-oidc] Token fetch failed (${res.status}): ${errText}`);
      return null;
    }

    const data = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      console.warn("[ledger-oidc] No access_token returned by Keycloak");
      return null;
    }

    const expiresInSec = typeof data.expires_in === "number" ? data.expires_in : 300;
    cachedOidcToken = {
      token: data.access_token,
      expiresAt: now + expiresInSec * 1000,
    };
    return cachedOidcToken.token;
  } catch (err) {
    console.warn(`[ledger-oidc] Network error contacting Keycloak: ${(err as Error).message}`);
    return null;
  }
}

export class LedgerClient {
  constructor(private readonly cfg: LedgerConfig) {}

  getBaseUrl(): string {
    return this.cfg.baseUrl;
  }

  async getAuthToken(): Promise<string | undefined> {
    if (this.cfg.token) return this.cfg.token;
    if (this.cfg.oidc) {
      const token = await acquireOidcToken(this.cfg.oidc);
      if (token) return token;
    }
    return undefined;
  }

  private async headers(): Promise<Record<string, string>> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    const token = await this.getAuthToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  private templateId(module: string, entity: string) {
    return {
      packageId: this.cfg.packageId,
      moduleName: module,
      entityName: entity,
    };
  }

  async create(
    actAs: string[],
    module: string,
    entity: string,
    args: unknown,
    disclosedContracts?: DisclosedContract[],
  ) {
    const commandsPayload: Record<string, unknown> = {
      commandId: `create-${Date.now()}`,
      actAs,
      commands: [
        {
          CreateCommand: {
            templateId: this.templateId(module, entity),
            createArguments: args,
          },
        },
      ],
    };
    if (disclosedContracts && disclosedContracts.length > 0) {
      commandsPayload.disclosedContracts = disclosedContracts;
    }
    const body = { commands: commandsPayload };
    return this.submit(body);
  }

  async exercise(
    actAs: string[],
    module: string,
    entity: string,
    contractId: string,
    choice: string,
    argument: unknown,
    disclosedContracts?: DisclosedContract[],
  ) {
    const commandsPayload: Record<string, unknown> = {
      commandId: `ex-${choice}-${Date.now()}`,
      actAs,
      commands: [
        {
          ExerciseCommand: {
            templateId: this.templateId(module, entity),
            contractId,
            choice,
            choiceArgument: argument,
          },
        },
      ],
    };
    if (disclosedContracts && disclosedContracts.length > 0) {
      commandsPayload.disclosedContracts = disclosedContracts;
    }
    const body = { commands: commandsPayload };
    return this.submit(body);
  }

  private async submit(body: unknown) {
    const h = await this.headers();
    const res = await fetch(`${this.cfg.baseUrl}/v2/commands/submit-and-wait`, {
      method: "POST",
      headers: h,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ledger submit failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async ledgerEnd(): Promise<string> {
    const h = await this.headers();
    const res = await fetch(`${this.cfg.baseUrl}/v2/state/ledger-end`, {
      headers: h,
    });
    if (!res.ok) throw new Error(`ledger-end failed: ${res.status}`);
    const data = (await res.json()) as { offset: string };
    return data.offset;
  }

  async queryActive(party: string, module: string, entity: string) {
    const offset = await this.ledgerEnd();
    const filter = `#${this.cfg.packageName}:${module}:${entity}`;
    const h = await this.headers();
    const res = await fetch(`${this.cfg.baseUrl}/v2/state/active-contracts`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        filter: {
          filtersByParty: {
            [party]: {
              cumulative: [
                {
                  identifierFilter: {
                    TemplateFilter: {
                      value: {
                        templateId: filter,
                        includeCreatedEventBlob: false,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
        activeAtOffset: offset,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`ACS query failed (${res.status}): ${text}`);
    }
    return res.json();
  }
}

export function ledgerFromEnv(): LedgerClient | null {
  const isLedgerMode = process.env.LEDGER_MODE === "ledger";
  const explicitUrl = process.env.LEDGER_API_URL;
  if (!isLedgerMode && !explicitUrl) return null;

  const baseUrl = (explicitUrl || SHARED_DEVNET_LEDGER_URL).replace(/\/$/, "");

  return new LedgerClient({
    baseUrl,
    token: process.env.LEDGER_API_TOKEN,
    oidc: {
      tokenUrl: process.env.OIDC_TOKEN_URL ?? SHARED_DEVNET_TOKEN_URL,
      audience: process.env.OIDC_AUDIENCE ?? SHARED_DEVNET_AUDIENCE,
      clientId: process.env.OIDC_CLIENT_ID,
      clientSecret: process.env.OIDC_CLIENT_SECRET,
      username: process.env.OIDC_USERNAME,
      password: process.env.OIDC_PASSWORD,
    },
    packageId: process.env.DAML_PACKAGE_ID ?? "composition-local",
    packageName: process.env.DAML_PACKAGE_NAME ?? "composition",
  });
}

