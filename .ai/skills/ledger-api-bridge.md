# Skill: Integrate Canton Ledger API v2 Bridge

## Objective
Manage and extend the Node.js/TypeScript backend ledger integration communicating with Canton JSON Ledger API v2 (port `:7575`) and the in-memory fallback store (`demoStore.ts`).

## Key Files
- `backend/src/ledger.ts` — `LedgerClient` implementation handling HTTP POST to `/v2/commands/submit-and-wait` and `/v2/state/active-contracts`.
- `backend/src/demoStore.ts` — High-fidelity in-memory state engine mirroring Propose → Accept → Settle with party ACS visibility scoping.
- `scripts/oidc-token.mjs` — Token retrieval script for Keycloak OIDC authentication on shared DevNet.

## Core Capabilities & Instructions
1. **JSON Ledger API v2 Conventions:**
   - **Endpoint:** `POST /v2/commands/submit-and-wait`
   - **Template Identifier Format:** `{ packageId, moduleName, entityName }`
   - **ACS Queries:** `POST /v2/state/active-contracts` using `activeAtOffset` from `/v2/state/ledger-end` and filter syntax `#<packageName>:<module>:<entity>`.
   - **Data Encodings:**
     - `Decimal` fields MUST be formatted as JSON strings (e.g., `"100.0"`).
     - `Date` fields formatted as `YYYY-MM-DD`.
     - `Optional` fields represented as `value | null`.
2. **Environment Variable Configuration:**
   - `LEDGER_API_URL`: Canton JSON Ledger API v2 base URL (e.g., `http://localhost:7575` or DevNet URL).
   - `LEDGER_API_TOKEN`: JWT Bearer token acquired via OIDC script.
   - `DAML_PACKAGE_ID`: Hash identifier of uploaded DAR package.
   - `DAML_PACKAGE_NAME`: Package name (default: `"composition"`).
3. **Graceful Degradation:**
   - If `LEDGER_API_URL` is omitted, the server operates in `"demo"` mode, using `DemoStore` to ensure that UI demos, integration workflows, and unit tests function without requiring a running Canton node.
