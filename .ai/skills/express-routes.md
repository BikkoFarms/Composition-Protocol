# Skill: Setup & Extend Express Routes

## Objective
Develop, maintain, and test the Express REST API endpoints in `backend/src/routes/` powering the frontend views and orchestrating protocol lifecycles.

## Key Files
- `backend/src/index.ts` — Server entry point, middleware setup (CORS, JSON), `/health` endpoint.
- `backend/src/routes/compositions.ts` — Lifecycle operations: `/propose`, `/:id/accept`, `/:id/settle`, and one-click demo `/demo/run-full` and `/demo/load`.
- `backend/src/routes/governance.ts` (or within compositions) — BitSafe M-of-N governance: `/governance/open`, `/governance/:id/approve`, `/governance/:id/execute`.
- `backend/src/routes/audit.ts` — Party views, `/audit/money-shot` side-by-side verification payload, and metrics.
- `backend/src/routes/assets.ts` — Token queries and minting endpoints.

## API Endpoint Reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Reports health, current mode (`ledger` vs `demo`), and package info |
| `GET` | `/assets?party=:party` | List visible tokens for a given party |
| `POST` | `/assets/mint` | Mint new mock token for testing |
| `GET` | `/compositions` | List active compositions and metrics |
| `POST` | `/compositions/propose` | Create a new multi-leg proposal |
| `POST` | `/compositions/:id/accept` | Record counterparty acceptance |
| `POST` | `/compositions/:id/settle` | Settle atomically across all legs |
| `POST` | `/compositions/demo/run-full` | Run complete end-to-end pitch demo |
| `POST` | `/compositions/demo/load` | Settle N transactions for metrics evidence |
| `GET` | `/audit/money-shot` | Side-by-side participant vs observer visibility payload |
| `GET` | `/audit/metrics` | Protocol throughput and atomic revert statistics |

## Error Handling Conventions
- Always return HTTP `409 Conflict` when an atomic settlement reverts, including `{ error: string, atomic: true, halfState: false }`.
- Return HTTP `400 Bad Request` for validation failures.
- Return HTTP `404 Not Found` for missing compositions or contracts.
