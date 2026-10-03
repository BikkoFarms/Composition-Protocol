# Comprehensive Testing Guide — Settleflow

Official testing manual for **Settleflow**: Daml scripts, backend gates, live E2E, and the interactive settlement desk (`/demo`).

**Specimen assets (canonical):** `CBTC` · `USDCx` · `cETH` (legs: collateral / cash / sponsor).

---

## 1. Multi-Layer Testing Matrix Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 4: Interactive Browser / UI                    │
│   /demo (Allocate + mismatch + settle) · /observer · /governance       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              Layer 3: Live E2E Integration Socket Suite                │
│   Network tests across Backend (:4000) & Oracle Feed (:4002)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│               Layer 2: Backend Automated Test Gates                    │
│       22 gates in backend/src/demoStore.test.ts                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Layer 1: Daml SDK Test Scripts                      │
│     On-ledger scripts in daml/daml/Test.daml + TestGovernance.daml     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Gate 1: Backend Automated Suites (27 Passing Gates)

### How to Run
```bash
cd backend
npm test
```

### Expected Output
All **27** tests pass (`# pass 27`, `# fail 0`), including:
- `allocation mismatch rejected — no half-state`
- `allocate → settle — commits + ready_to_settle gate`
- `FR-8: demo assets issuance produces valid CIP-56 holdings`
- `FR-9: audit trail provides per-party scoped history`
- `FR-10: failure path — wrong executor rejected`
- `FR-10: failure path — cancelled trade releases locked allocations`
- `FR-10 & FR-11: partial allocation blocks settlement until all legs ready`
- Atomic / privacy / BitSafe / SRS §12 gates (see README §6)

### Allocation & PRD Invariants (Headline)

| Test | Spec | Verification |
| :--- | :--- | :--- |
| **allocation mismatch rejected** | Field match | Wrong amount → `allocation match failed: amount mismatch on leg cash`; allocations stay `0` |
| **allocate → settle** | Readiness | Settle without allocations fails; after 3 matches → `ready_to_settle` → receipt |
| **wrong executor rejected** | Permissioning | Non-designated caller attempting settlement fails with `wrong executor` |
| **cancel releases allocations** | Clean withdrawal | Cancelled trade clears locked allocations back to parties without half-state |
| **partial allocation gate** | Readiness tracking | Settlement is rejected if any leg remains unallocated |
| **audit trail per party** | Stakeholder privacy | Each party receives scoped events and receipts; regulator sees `visibleTokens: []` |

---

## 2.1 Test Gate 1.1: PRD §7 8-Step Demo Scenario Runner

Run the authoritative PRD §7 sequence in one automated, deterministic runbook:
```bash
npm run demo:scenario
```
Verifies: Issue (FR-8) → Propose (FR-1) → Authorize (FR-2, FR-3) → Mismatch (FR-4) → Status (FR-5, FR-11) → Execute (FR-6) → Cancel & Release (FR-7, FR-10) → Audit Trail (FR-9).

---

## 3. Test Gate 2: Daml On-Ledger Script Verification

Requires [Daml SDK 3.3.x](./docs/DAML_SETUP.md):

```bash
cd daml
daml test
```

Includes `testAllocHappyPath3PartyDvp`, mismatch / withdraw / unauthorized executor scripts, `testAuditorCannotSeeLegs`, BitSafe threshold scripts, and SRS §12 workflow gates. Specimen legs use **CBTC / USDCx / cETH**.

---

## 4. Test Gate 3: Live E2E Integration Socket Suite

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Oracle (optional for price checks)
node mocks/oracle/server.mjs

# From repo root (when script present)
npm run test:e2e
```

Happy path must allocate before settle when exercising `/compositions/:id/settle` against demoStore (allocations required). Prefer `/compositions/demo/run-full` or `/compositions/demo/open-desk` + per-leg `/allocate` for judge demos.

**DevNet receipt:** With `LEDGER_API_URL` + token configured, `GET /health` reports `mode: ledger`; settlement returns a ledger `receiptCid` / update id (see [docs/DEVNET.md](./docs/DEVNET.md)).

---

## 5. Test Gate 4: Interactive Browser / UI Verification

```bash
cd frontend && npm run dev
```
Open [http://localhost:3000/demo](http://localhost:3000/demo).

### 1. Allocation matching centerpiece (`/demo`) — **default judge path**
1. Click **"Run allocation matching demo"**.
2. Watch live commits (not a timer animation):
   - **Proposed** — agreement after accept (`proposalCid` / `agreementCid` / `updateId`)
   - **Allocate CBTC** — matched fields + `AllocateLeg` commit
   - **Mismatch** — wrong USDCx amount → verbatim `allocation match failed: amount mismatch on leg cash`
   - **Correct allocations** — USDCx + cETH → `ready_to_settle`
   - **Settle** — receipt + money-shot preview
3. Confirm the **Why builders adopt this** panel (~99 vs ~192 LOC) is visible on the same page.

### 2. Manual mismatch
1. **Open desk only** → **Submit wrong amount** → reject banner with verbatim reason → correct via re-run or full matching demo.

### 3. One-click settle (secondary)
1. **One-click settle** — allocate-all + settle (no mismatch beat). Keep secondary to the matching demo.

### 4. Observer money shot (`/observer`)
1. After settle, open `/observer` or **Prove money shot**.
2. Regulator: `visibleTokens: []` + `SettlementReceipt`.

### 5. BitSafe (`/governance`)
1. **Camera beat: refuse → settle** — below threshold reject, then 2-of-3 execute.

### 6. Admin (`/admin`)
1. Mint `CBTC` / `USDCx` / `cETH` as needed; circuit breaker toggle.

---

## 6. Test Gate 5: High-Throughput Load

```bash
curl -X POST http://localhost:4000/compositions/demo/load \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

Or **Settle 50 tickets** on `/demo`. Charts: [http://localhost:3000/metrics](http://localhost:3000/metrics).
