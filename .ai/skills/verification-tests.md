# Skill: Run Atomicity, Privacy & Governance Tests

## Objective
Execute and maintain the automated acceptance test gates across both Daml Script and Node.js test runners.

## Test Suites & Gate Definitions

### 1. `testAtomicSwap` (Happy Path)
- **Assertion:** A multi-party deal (proposer + counterparties) with 2+ legs settles in a single atomic transaction.
- **Verification:** All target parties receive their respective assets, agreement status becomes `settled`, and a valid `SettlementReceipt` is generated.

### 2. `testAtomicRevert` (Failure Path / No Half-State)
- **Assertion:** When one leg in a multi-leg composition fails (e.g. invalid asset or pre-consumed contract), the entire transaction aborts.
- **Verification:** Zero intermediate state. Original asset holders still retain ownership of their assets. Metrics show `compositionsReverted` incremented.

### 3. `testAuditorCannotSeeLegs` (Observer Privacy / The Money Shot)
- **Assertion:** Regulators or observers added to the settlement can confirm settlement occurred via `SettlementReceipt`, but cannot see individual leg payloads or underlying tokens.
- **Verification:**
  - `observer.visibleTokens` is strictly `[]`.
  - `observer.settlementReceipts` contains the receipt with status and timestamps.
  - No leak of participant balances or private trade terms.

### 4. `testGovernedBelowThreshold` & `testGovernedAtThreshold` (BitSafe M-of-N)
- **Assertion:** Governed settlements require an explicit M-of-N threshold of governor signatures before execution can proceed.
- **Verification:** Attempting to execute with `< M` approvals throws `below threshold`. Executing with `== M` approvals succeeds and settles atomically.

## Execution Commands

### Node.js Acceptance Suite (Backend):
```bash
cd backend
npm test
```

### Daml Script Suite (Requires Daml SDK 3.3.x):
```bash
cd daml
daml test
```
