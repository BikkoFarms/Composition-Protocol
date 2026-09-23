/**
 * Canton JSON Ledger API v2 client.
 * Encoding: Decimal as JSON string; Date as YYYY-MM-DD; Optional as value|null.
 * Commands use package-id templateIds; ACS queries use package-name filters.
 */
export type LedgerConfig = {
  baseUrl: string;
  token?: string;
  packageId: string;
  packageName: string;
};

export class LedgerClient {
  constructor(private readonly cfg: LedgerConfig) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.token) h.Authorization = `Bearer ${this.cfg.token}`;
    return h;
  }

  private templateId(module: string, entity: string) {
    return {
      packageId: this.cfg.packageId,
      moduleName: module,
      entityName: entity,
    };
  }

  async create(actAs: string[], module: string, entity: string, args: unknown) {
    const body = {
      commands: {
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
      },
    };
    return this.submit(body);
  }

  async exercise(
    actAs: string[],
    module: string,
    entity: string,
    contractId: string,
    choice: string,
    argument: unknown,
  ) {
    const body = {
      commands: {
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
      },
    };
    return this.submit(body);
  }

  private async submit(body: unknown) {
    const res = await fetch(`${this.cfg.baseUrl}/v2/commands/submit-and-wait`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ledger submit failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  async ledgerEnd(): Promise<string> {
    const res = await fetch(`${this.cfg.baseUrl}/v2/state/ledger-end`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`ledger-end failed: ${res.status}`);
    const data = (await res.json()) as { offset: string };
    return data.offset;
  }

  async queryActive(party: string, module: string, entity: string) {
    const offset = await this.ledgerEnd();
    const filter = `#${this.cfg.packageName}:${module}:${entity}`;
    const res = await fetch(`${this.cfg.baseUrl}/v2/state/active-contracts`, {
      method: "POST",
      headers: this.headers(),
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
  const baseUrl = process.env.LEDGER_API_URL;
  if (!baseUrl) return null;
  return new LedgerClient({
    baseUrl: baseUrl.replace(/\/$/, ""),
    token: process.env.LEDGER_API_TOKEN,
    packageId: process.env.DAML_PACKAGE_ID ?? "composition-local",
    packageName: process.env.DAML_PACKAGE_NAME ?? "composition",
  });
}
