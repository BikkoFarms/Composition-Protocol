# DevNet / LocalNet wiring

## Demo mode (default)

No Canton node required. Backend serves an in-memory store that mirrors
Propose → Accept → Allocate → Settle and per-party ACS visibility.

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Pitch URLs:

- Settlement: http://localhost:3000/demo  
- Money shot (observer vs participant): http://localhost:3000/observer  
- BitSafe M-of-N: http://localhost:3000/governance  

## Shared HackCanton DevNet

JSON Ledger API (public participant):

`https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`

### Env (backend/.env)

```bash
LEDGER_MODE=ledger
LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services

# Auth — either static token or OIDC password grant
# LEDGER_API_TOKEN=...
OIDC_TOKEN_URL=https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token
OIDC_AUDIENCE=https://hackcanton-01.devnet.naas.noders.services
OIDC_CLIENT_ID=...
OIDC_USERNAME=...
OIDC_PASSWORD=...
# OIDC_CLIENT_SECRET=...   # if confidential client

DAML_PACKAGE_ID=<hash after DAR upload>
DAML_PACKAGE_NAME=composition

# Party IDs on the participant (opaque — from allocate/listKnownParties)
LEDGER_PARTY_OPERATOR=...
LEDGER_PARTY_ALICE=...
LEDGER_PARTY_BOB=...
LEDGER_PARTY_ORACLE=...
LEDGER_PARTY_REGULATOR=...
```

Encodings (Ledger JSON API v2):

| Type | Wire form |
|---|---|
| Decimal | JSON **string** (`"100.0"`) |
| Date | `YYYY-MM-DD` |
| Time | ISO-8601 |
| Optional | value or `null` |
| Commands | **package-id** in `templateId` |
| ACS filters | **package-name** `#composition:Module:Entity` |

### Token check

```bash
node scripts/oidc-token.mjs
# or
curl -s -X POST "$OIDC_TOKEN_URL" -d "grant_type=password&client_id=...&username=...&password=...&audience=..."
```

### DAR upload

```bash
cd daml && daml build
# upload .daml/dist/composition-0.1.0.dar via participant admin / console
# copy resulting package id into DAML_PACKAGE_ID
```

### Live E2E

```bash
cd backend && npm run dev
curl -s -X POST http://localhost:4000/compositions/ledger/e2e | jq
# Returns updateId + contractIds (proposal, agreement, receipt) on the public ledger URL
```

Or: `node scripts/e2e-devnet.mjs`

`/health` should report `"mode":"ledger"`, `"ledgerReachable": true`.  
`/audit/money-shot` then queries **live** Bob vs Regulator ACS.

## Acceptance gates

| Gate | Command |
| --- | --- |
| Demo store (Node) | `cd backend && npm test` |
| Daml Script | `cd daml && daml test` |
| BitSafe LocalNet | `testGovernedBelowThreshold`, `testGovernedAtThreshold`, cancel twins |
| Privacy | `testAuditorCannotSeeLegs` + `/observer` |

## BitSafe LocalNet

Controllers: **Gov1, Gov2, Gov3**. Threshold: **2-of-3**.  
UI: http://localhost:3000/governance  
Setup: [DAML_SETUP.md](./DAML_SETUP.md) § BitSafe LocalNet.
