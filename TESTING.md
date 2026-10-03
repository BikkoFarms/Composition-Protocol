# Comprehensive Testing Guide — Settleflow

This document is the official, step-by-step testing manual for verifying the **Settleflow**. It guides developers, auditors, and hackathon judges through each test layer—from on-ledger Daml contracts to automated backend test gates, live end-to-end network tests, and interactive UI verification.

---

## 1. Multi-Layer Testing Matrix Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Layer 4: Interactive Browser / UI                    │
│   Next.js 15 App: /demo, /proposer, /counterparty, /governance, etc.   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              Layer 3: Live E2E Integration Socket Suite                │
│   13 Network Tests across Backend (:4000) & Oracle Feed (:4002)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│               Layer 2: Backend Automated Test Gates                    │
│       20 Automated Suites in backend/src/demoStore.test.ts             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    Layer 1: Daml SDK Test Scripts                      │
│     9 On-Ledger Test Scripts in daml/daml/Test.daml (SRS §12 Gates)    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Gate 1: Backend Automated Suites (20 Passing Gates)

The backend automated test suite verifies all protocol rules, invariant assertions, failure paths, and SRS §12 acceptance criteria against the simulated Daml engine.

### How to Run
From the repository root:
```bash
npm test
```
Or directly from the `backend/` directory:
```bash
cd backend
npm test
```

### Expected Output
All 20 test suites pass with **0 failures**:
```
TAP version 13
# Subtest: Settleflow demo gates
    ok 1 - testAtomicSwap — 2+ legs settle all-or-nothing
    ok 2 - testAtomicRevert — failed leg leaves no half-state
    ok 3 - testAuditorCannotSeeLegs — regulator visibleTokens [] + receipt
    ok 4 - R-GOV-1 below threshold rejected
    ok 5 - R-GOV-1 at threshold succeeds
    ok 6 - Judge Metrics — calculates avgLegsPerComposition, successRate, revertRate
    ok 7 - Proposer Cancellation — allows clean withdrawal before settlement
    ok 8 - Emergency Circuit Breaker — blocks settlement during halt and resumes
    ok 9 - Institutional Emergency Veto — named governor can abort open governed deal
    ok 10 - Cryptographic Deal Hash & Valuation — enforces sha256 digest and LTV ratio
    ok 11 - Operator Treasury Direct Minting — issues new composable assets to party ACS
    ok 12 - Failure Path: Expiry — resolves stalled or timed-out proposals cleanly
    ok 13 - Failure Path: Rejection — counterparty rejection cleanly resolves without half-state
    ok 14 - Failure Path: Partial completion — maintains valid state without leaking or premature execution
    ok 15 - Disclosed Contract Handling — attaches and preserves explicit contract disclosures
    ok 16 - Reuse Verification — executes multiple distinct 3-party DvP configurations without modifying package logic
    ok 17 - SRS §12: testWorkflowProposal — confirms proposal creation and workflow initialization
    ok 18 - SRS §12: testWorkflowAcceptance — confirms acceptance and state progression
    ok 19 - SRS §12: testWorkflowExpiryOrCancel — confirms stalled workflows resolve cleanly
    ok 20 - SRS §12: testWorkflowSettlement — confirms settlement completes end to end
1..20
ok 1 - Settleflow demo gates
# tests 20
# suites 1
# pass 20
# fail 0
```

### Detailed Breakdown of Test Invariants

| Test Suite | Specification Invariant | Verification Logic |
| :--- | :--- | :--- |
| **1. testAtomicSwap** | `R-ATOM-1` | 3 distinct legs (collateral, cash, fee) transfer atomically in a single simulated Daml transaction. |
| **2. testAtomicRevert** | `R-ATOM-2` | Deliberately injected failure aborts the entire transaction; all party ACS balances remain 100% unchanged. |
| **3. testAuditorCannotSeeLegs** | `R-PRIV-1/2/3` | Non-participating auditor/regulator receives settlement notification where `visibleTokens: []`, proving zero leg leakage. |
| **4. R-GOV-1 Below Threshold** | Governance Gate | Governed settlement execution fails with HTTP 409 when approvals < M (e.g. 1 of 2 required). |
| **5. R-GOV-1 At Threshold** | Governance Gate | Governed settlement succeeds once M-of-N threshold signatures (e.g. 2 of 2) are collected. |
| **6. Judge Metrics** | HackCanton Audit | Calculates `avgLegsPerComposition`, `successRate`, and `revertRate` across all lifetime transactions. |
| **7. Proposer Cancellation** | Clean Failure Path | Proposer Alice can cleanly withdraw a pending proposal before counterparties sign; reverts cleanly. |
| **8. Emergency Circuit Breaker** | Risk Controls | Circuit breaker halt blocks any settlement attempt; unhalt allows normal flow resumption. |
| **9. Institutional Emergency Veto** | Governance Veto | Designated institutional governor aborts open governed workflow before settlement. |
| **10. Deal Hash & Valuation** | Cryptographic Integrity | Computes SHA-256 digest of terms; validates Loan-To-Value (LTV) limit (< 80%). |
| **11. Treasury Direct Minting** | Asset Discovery | Admin direct-mints composable assets (`CBTC`, `USDCx`) directly into party ACS. |
| **12. Failure Path: Expiry** | SRS §7.4 | Simulates deadline passing; moves proposal to `expired` state without dangling contracts. |
| **13. Failure Path: Rejection** | SRS §7.4 | Counterparty Bob rejects unfavorable proposal; cleanly resolves without partial state. |
| **14. Failure Path: Partial State** | SRS §7.4 | Proposer signs, Counterparty 1 signs, Counterparty 2 pending; verified that no execution occurs prematurely. |
| **15. Disclosed Contracts** | SRS §7.3 | Attaches external contract disclosures (`contractId`, `createdEventBlob`) and validates persistence. |
| **16. Reusability Verification** | PRD Core Claim | Executes multiple distinct 3-party DvP variations (different assets, parties, quantities) without altering underlying Daml package code. |
| **17. SRS §12: testWorkflowProposal** | SRS §12 Gate 1 | Confirms workflow proposal creation and tracker initialization. |
| **18. SRS §12: testWorkflowAcceptance** | SRS §12 Gate 2 | Confirms counterparty acceptance transitions status from `proposed` to `accepted`. |
| **19. SRS §12: testWorkflowExpiryOrCancel** | SRS §12 Gate 3 | Confirms both cancellation and expiration resolve stalled workflows cleanly. |
| **20. SRS §12: testWorkflowSettlement** | SRS §12 Gate 4 | Confirms full end-to-end settlement completion and receipt generation. |

---

## 3. Test Gate 2: Daml On-Ledger Script Verification (9 Scripts)

When the Daml SDK 3.3.x is available ([DAML_SETUP.md](./docs/DAML_SETUP.md)), run the on-ledger scripts against the Daml compiler and Canton Ledger simulator.

### How to Run
```bash
cd daml
daml test
```

### Verified Script Gates
1. `testAtomicSwap`: Verifies all-or-nothing multi-party DvP execution.
2. `testAtomicRevert`: Proves that choice failure rolls back all leg modifications.
3. `testAuditorCannotSeeLegs`: Proves sub-transaction privacy by checking regulator visibility projections.
4. `testGovernedBelowThreshold`: Asserts choice failure if governor approvals < M.
5. `testGovernedAtThreshold`: Asserts choice success once approvals >= M.
6. `testWorkflowProposal`: Validates SRS §12 workflow initialization.
7. `testWorkflowAcceptance`: Validates SRS §12 counterparty acceptance progression.
8. `testWorkflowExpiryOrCancel`: Validates SRS §12 clean cancellation and expiration.
9. `testWorkflowSettlement`: Validates SRS §12 complete end-to-end DvP execution.

---

## 4. Test Gate 3: Live E2E Integration Socket Suite (13 Tests)

The live E2E suite performs real HTTP socket calls against running instances of the **Backend** (:4000) and the **Mock Oracle** (:4002).

### Step 1: Start Background Services
In separate terminal tabs (or via `npm run install:all`):
```bash
# Terminal 1: Backend
npm run dev:api

# Terminal 2: Oracle
npm run dev:oracle
```

### Step 2: Run Live E2E Test Suite
From the repository root:
```bash
npm run test:e2e
# Or directly:
node scripts/test-e2e-live.mjs
```

### Expected Output
All 13 integration tests pass with green checks:
```
--- 1. Health check ---
  GET /health -> ok (status: 200)

--- 2. Assets discovery ---
  GET /assets -> 5 assets discovered

--- 3. Oracle feed check ---
  GET :4002/prices/CBTC -> ok ($65000)

--- 4. Propose 3-leg trade-finance composition ---
  POST /compositions/propose -> id: trade-finance-... (status: proposed)

--- 5. Counterparty acceptance (Bob) ---
  POST /compositions/:id/accept -> acceptedBy: ["Bob"] (status: accepted)

--- 6. Atomic settlement execution ---
  POST /compositions/:id/settle -> settled (receipt: receipt-...)

--- 7. Atomic revert injection test ---
  POST /compositions/propose (forceFail=true) -> id: ...
  POST /compositions/:id/settle -> 409 Conflict (atomic: true, halfState: false)

--- 8. Auditor privacy check ---
  GET /audit/settlements -> receipt confirmed with visibleTokens: []

--- 9. Proposer cancellation path ---
  POST /compositions/propose -> cancel test
  POST /compositions/:id/cancel -> status: cancelled

--- 10. Expiry failure path ---
  POST /compositions/propose (with expiresAt)
  POST /compositions/:id/expire -> status: expired

--- 11. Rejection failure path ---
  POST /compositions/propose
  POST /compositions/:id/reject -> status: rejected

--- 12. Governance emergency veto ---
  POST /compositions/governance/open
  POST /compositions/governance/:id/veto -> status: vetoed

--- 13. Circuit breaker operational halt ---
  POST /compositions/circuit-breaker/toggle -> halted: true
  POST /compositions/:id/settle -> blocked by circuit breaker
  POST /compositions/circuit-breaker/toggle -> halted: false

Summary: 13 / 13 tests passed!
```

---

## 5. Test Gate 4: Interactive Browser / UI Verification

The web frontend includes dedicated roles and desks for interactive testing.

### Step 1: Launch Web UI
```bash
npm run dev:web
```
Open [http://localhost:3000](http://localhost:3000) (or `:3100`).

### Step 2: Test Interactive Workflows

#### 1. One-Click Happy Path Demo (`/demo`)
1. Click **"Run Full 3-Party DvP Settlement"**.
2. Observe the animated 3-step timeline:
   - Leg 1: Collateral Transfer (`Alice` -> `Bob`, 1.5 CBTC)
   - Leg 2: Currency Payment (`Bob` -> `Alice`, 97,500 USDCx)
   - Leg 3: Settlement Fee (`Alice` -> `Oracle/Facilitator`, 25 USDCx)
3. Check the **Privacy Matrix**: Confirm that Alice and Bob see their respective legs, while the Regulator ACS displays `visibleTokens: []`.

#### 2. Atomic Revert Injection (`/demo`)
1. Toggle the **"Simulate Failure (Test Atomicity)"** switch.
2. Click **"Run Full 3-Party DvP Settlement"**.
3. Verify that the UI displays **409 Conflict: ATOMIC_REVERT**.
4. Confirm zero token balance movement in the Balances table.

#### 3. Proposer Desk (`/proposer`)
1. View active proposals initiated by Alice.
2. Click **"Create Custom Proposal"**, select assets and counterparty.
3. Test the **"Cancel Proposal"** button on an open proposal; verify it transitions immediately to `Cancelled`.

#### 4. Counterparty Desk (`/counterparty`)
1. Switch to Bob's view.
2. Inspect pending proposals requiring counterparty signature.
3. Click **"Accept Terms"** to sign and advance state.
4. Click **"Reject Terms"** on another proposal with a reason; verify clean rejection.

#### 5. Governance Desk (`/governance`)
1. Observe open BitSafe M-of-N proposals (2-of-3 threshold).
2. Cast Governor 1 vote -> Verify status shows `1/2 Approvals (Threshold Not Met)`.
3. Cast Governor 2 vote -> Verify status updates to `2/2 Approvals (Ready for Settlement)`.
4. Click **"Execute Governed Settlement"** -> Confirm settlement completion.
5. On another deal, test **"Emergency Governor Veto"** -> Confirm immediate deal abort.

#### 6. Regulator / Observer Desk (`/observer`)
1. View on-ledger settlement receipts.
2. Verify that transaction hash, timestamp, and party IDs are present.
3. Confirm that asset amounts and token IDs are strictly hidden (`visibleTokens: []`).

#### 7. Treasury & Admin Desk (`/admin`)
1. Click **"Mint 1.0 CBTC to Alice"** -> Verify instant balance update.
2. Click **"Toggle Emergency Circuit Breaker"** -> Verify protocol enters `HALTED` state.
3. Attempt a settlement -> Confirm blocked with error.
4. Toggle circuit breaker again -> Confirm normal operation restored.

---

## 6. Test Gate 5: High-Throughput Load & Benchmarking

To benchmark settlement throughput and atomicity under rapid transaction volume:

### How to Run
Send an HTTP POST request to the load benchmark endpoint:
```bash
curl -X POST http://localhost:4000/compositions/demo/load \
  -H "Content-Type: application/json" \
  -d '{"count": 50}'
```

### Expected Response
```json
{
  "requested": 50,
  "successful": 50,
  "failed": 0,
  "durationMs": 42,
  "compositionsPerSec": 1190.48,
  "metrics": {
    "totalCompositions": 50,
    "successfulCompositions": 50,
    "failedCompositions": 0,
    "totalSettledVolumeUsd": 4875000,
    "avgLegsPerComposition": 3,
    "revertRate": 0
  }
}
```
View the live updated charts and metrics on [http://localhost:3000/metrics](http://localhost:3000/metrics).
