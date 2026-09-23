# Composition Protocol

**Atomic, private, multi-asset settlement for Canton** — demonstrated through African commodity trade finance.

HackCanton Season 3 · Track 1 (RWA & Business Workflows) primary · Team: **Revotoken Africa**

> The protocol is the product. The trade-finance flow is the demo that gives it a face.

## What it is

CIP-0056 made single assets portable; Composition Protocol makes them **combinable**. Builders call a shared Daml primitive that bundles several asset transfers into one deal that either **all settles or none does**, with **per-leg privacy** enforced by Canton’s stakeholder model (`signatory` / `observer`) — not a UI filter.

Demo topology (3 legs):

| Leg | Asset | From → To |
| --- | --- | --- |
| Collateral | CBTC | Exporter (Alice) → Lender (Bob) |
| Cash | USDCx | Lender (Bob) → Exporter (Alice) |
| Attestation | Oracle grade | Oracle → Lender |

## Repo map

```
daml/           Daml 3.x contracts + Script tests
backend/        Express Ledger API v2 bridge + demo store (:4000)
frontend/       Next.js role views (:3000)
mocks/oracle/   Mock price oracle (:4002)
docs/           PRD + SRD
```

### Daml templates

| Contract | Role |
| --- | --- |
| `ComposableAsset` | CIP-0056-shaped interface (`Transfer`) |
| `MockToken` | MVP token implementing the interface |
| `CompositionProposal` | Propose / Accept / Reject / Expire |
| `AcceptanceTracker` | Gates settlement until all counterparties accept |
| `CompositionAgreement` | Atomic `Settle` over all legs |
| `SettlementReceipt` | Proof of settlement; regulator observes receipt only |

### Acceptance tests (gates)

- `testAtomicSwap` — 2 parties, 2 assets, atomic end state
- `testAtomicRevert` — one leg fails → full revert, no half-state
- `testAuditorCannotSeeLegs` — regulator `visibleTokens: []`, receipt found

## Quick start (demo mode — no Canton node)

```bash
# terminal 1 — API
cd backend && npm install && npm run dev

# terminal 2 — UI
cd frontend && npm install && npm run dev

# optional — mock oracle
node mocks/oracle/server.mjs
```

Open [http://localhost:3000](http://localhost:3000):

1. **Proposer** → Propose trade-finance deal  
2. **Counterparty** → Accept as Bob, then Oracle  
3. **Proposer** → Settle atomically  
4. **Observer** → money shot: empty `visibleTokens`, receipt present  

## Daml build & test

Requires [Daml SDK](https://docs.daml.com/) 3.3.x:

```bash
cd daml
daml build
daml test
```

## Live Canton ledger

Set env (LocalNet or shared HackCanton DevNet):

```bash
export LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
export LEDGER_API_TOKEN=<oidc-token>
export DAML_PACKAGE_ID=<uploaded-dar-package-id>
```

OIDC token endpoint (shared node):  
`https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token`

Backend `ledger.ts` implements JSON Ledger API v2 `create` / `exercise` / ACS query. With `LEDGER_API_URL` unset, the API serves an in-memory store that mirrors Propose → Accept → Settle and per-party visibility for UI/demo work.

## Pre-existing code disclosure

Per HackCanton S3 rules: any Daml contracts/tests predating **18 Sept 2026** must be disclosed here. **This repository’s initial delivery-phase commit is the first public codebase** — no prior private DAR is claimed as in-window work. Delivery window: **18 Sept – 9 Oct 2026**. Judges evaluate only in-window work.

## Product docs

- [docs/Composition_Protocol_PRD.pdf](docs/Composition_Protocol_PRD.pdf)
- [docs/Composition_Protocol_SRD.pdf](docs/Composition_Protocol_SRD.pdf)

## License

Apache-2.0 (open-source infrastructure primitive).
