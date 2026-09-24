# DevNet / LocalNet wiring

## Demo mode (default)

No Canton node required. Backend serves an in-memory store that mirrors
Propose → Accept → Settle and per-party ACS visibility.

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Pitch URL: http://localhost:3000/demo

## Shared HackCanton DevNet

JSON Ledger API:

`https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`

OIDC token:

```bash
export OIDC_CLIENT_ID=...
export OIDC_USERNAME=...
export OIDC_PASSWORD=...
# optional for confidential clients:
# export OIDC_CLIENT_SECRET=...

export LEDGER_API_TOKEN=$(node scripts/oidc-token.mjs)
export LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
export DAML_PACKAGE_ID=<dar-package-id-after-upload>
```

Then restart the backend. `/health` should report `"mode":"ledger"`.

### DAR upload

```bash
cd daml
daml build
# upload .daml/dist/composition-0.1.0.dar via participant admin API / console
```

## Acceptance gates

| Gate | Command |
| --- | --- |
| Demo store (Node) | `cd backend && npm test` |
| Daml Script | `cd daml && daml test` |

## BitSafe LocalNet

UI: http://localhost:3000/governance  
Daml: `testGovernedBelowThreshold`, `testGovernedAtThreshold`
