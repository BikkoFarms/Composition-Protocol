# AI-guided project journal (HackCanton judging artifact)
# Log daily: Value → ICP → Metrics → GTM → MVP → Pitch

## 2026-09-23
- Ingested PRD/SRD; scaffolded monorepo (Daml + Express + Next.js).
- MVP surfaces: Propose / Accept / Settle + observer money-shot UI.
- Demo store mirrors per-leg privacy for LocalNet without node.
- Next: `daml test` on SDK 3.3; wire OIDC + upload DAR to shared DevNet; book builder interviews.

## 2026-09-24
- **MVP:** One-click pitch demo (`/demo`, `POST /compositions/demo/run-full`).
- **Metrics:** `/metrics` UI + `POST /compositions/demo/load` (50 settlements evidence).
- **BitSafe secondary:** Daml `Governance` + `TestGovernance`; demo 2-of-3 UI at `/governance`, plus `EmergencyVeto` / `ProtocolCircuitBreaker`.
- **Validation:** Backend gate suites covering atomicity, revert, privacy, M-of-N, veto, circuit breaker.
- **Design:** Lattice (parchment / forest ink / pastel specimen cards) — `docs/DESIGN.md`.
- **Interviews:** `docs/INTERVIEWS.md` guide for Metrics criterion.
- **OIDC:** backend `/admin/refresh-token` + health `ledgerReachable`.
- **Mission Control:** `/admin` portal (latency ping, ledger/demo toggle, treasury mint, reset).
- **Oracle:** `mocks/oracle/server.mjs` — spot quotes + HMAC-SHA256 warehouse certificates on :4002.
- **Docs:** `CONTRIBUTING.md`, `docs/RISK_ASSESSMENT.md`, judging alignment for Track 1 + BitSafe.
- **GTM/DevNet:** `scripts/oidc-token.mjs` + `docs/DEVNET.md` + live e2e runner.
- Next: upload DAR to Noders DevNet; run 3–5 builder interviews; live judging walkthrough.
