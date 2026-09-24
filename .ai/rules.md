# Composition Protocol — Agentic Architectural Rules & System Constraints

## 1. System Identity & Mission
Composition Protocol is an atomic, private, multi-asset settlement primitive built on Canton for HackCanton Season 3 (Track 1: RWA & Business Workflows primary; BitSafe Decentralization challenge secondary).
- **Core Premise:** While CIP-0056 made individual assets portable, Composition Protocol makes them *combinable*.
- **Reference Flow:** African commodity trade finance across 3 legs (Collateral: CBTC, Cash: USDCx, Attestation: Oracle Grade).
- **Golden Rule:** "The protocol is the product. The trade-finance flow is the demo that gives it a face."

---

## 2. Hard Architectural Invariants

### 2.1 Atomicity (`R-ATOM-1`, `R-ATOM-2`)
- **Single-Transaction Settle (`R-ATOM-1`):** All settlement legs must execute in a single, atomic Daml transaction (`CompositionAgreement.Settle` or `SettleWithRegulator`).
- **No Half-States (`R-ATOM-2`):** Zero intermediate or half-settled states. If any leg fails (e.g., asset already consumed, invalid signatory, insufficient funds), the entire Daml transaction aborts and reverts completely. Providers retain their original assets.
- **Pre-execution Gate:** Settlement cannot be initiated until `AcceptanceTracker` verifies that 100% of required counterparties have co-signed/accepted the proposal (`Set.isSubsetOf required accepted`).

### 2.2 Privacy & Canton Stakeholder Model (`R-PRIV-1`, `R-PRIV-2`, `R-PRIV-3`)
- **Per-Leg Payload Confidentiality (`R-PRIV-1`):** Asset payloads, balances, and transfer choices are strictly scoped to leg participants (provider + receiver) using Canton `signatory` and `observer` boundaries.
- **Cryptographic Regulator Exclusion (`R-PRIV-2`):** Auditors and regulators observe only `SettlementReceipt` (containing high-level status, timestamps, and deal description). They are cryptographically excluded from seeing leg asset contract IDs and token payloads (`visibleTokens: []`).
- **No UI-Layer Privacy Fakes (`R-PRIV-3`):** Privacy is enforced at the sub-transaction / ACS level by Canton's privacy model, verifiable via `query @MockToken regulator == []`.

### 2.3 BitSafe Governance (`R-GOV-1`, `R-GOV-2`)
- **Threshold Gating (`R-GOV-1`):** When governed settlement is required, `GovernedSettlement.ExecuteGoverned` MUST strictly fail if cumulative approvals are below the configured threshold `M` of `N` (`approvals < threshold`).
- **Threshold Execution (`R-GOV-2`):** Once `threshold` approvals are recorded, `ExecuteGoverned` must atomically trigger `SettleWithRegulator`.

---

## 3. Tech Stack Compliance

| Layer | Technology | Enforced Constraints |
|---|---|---|
| **Contracts** | Daml 3.x (`3.3.0`), `--target=2.1` | Uses `daml-prim`, `daml-stdlib`, `daml-script`. Strict adherence to `ComposableAsset` interface. |
| **Backend Bridge** | Node.js 20+ / TypeScript Express | Dual-mode: Canton JSON Ledger API v2 (`submit-and-wait`, `active-contracts`, offset tracking) when `LEDGER_API_URL` is set; memory `demoStore` when unset. |
| **Frontend** | Next.js 14+ (App Router) / React / TS | Role-based views (`/demo`, `/proposer`, `/counterparty`, `/observer`, `/governance`, `/metrics`). Dark mode, crisp typography, live polling. |
| **Mocks & Oracles** | Node.js HTTP / ESM | Mock Price & Grade Oracle running on port `:4002`. |
| **DevNet / Ledger** | Canton DevNet / LocalNet (`:7575`) | Token exchange via OIDC Keycloak endpoint. |

---

## 4. Contract Data Model & Choice Hierarchy

```
ComposableAsset (Interface)
  └── MockToken (Template: owner, issuer, instrumentId, amount)
        └── choice Transfer : TransferResult

CompositionProposal (signatory: proposer, operator; observer: counterparties)
  ├── choice CancelProposal : ()
  ├── choice RejectProposal : ()
  ├── choice ExpireProposal : ()
  └── nonconsuming choice AcceptProposal : ContractId AcceptanceTracker

AcceptanceTracker (signatory: operator; observer: required)
  ├── choice RecordAcceptance : ContractId AcceptanceTracker
  └── choice FinalizeAgreement : ContractId CompositionAgreement

CompositionAgreement (signatory: operator; observer: parties)
  ├── choice CancelAgreement : ()
  ├── choice Settle : ContractId SettlementReceipt
  └── choice SettleWithRegulator : ContractId SettlementReceipt

SettlementReceipt (signatory: operator; observer: participants ++ regulators)

GovernedSettlement (signatory: operator; observer: governors)
  ├── choice ApproveGoverned : ContractId GovernedSettlement
  ├── choice EmergencyVeto : ()
  └── choice ExecuteGoverned : ContractId SettlementReceipt

ProtocolCircuitBreaker (signatory: operator; observer: governors)
  ├── choice PauseSettlements : ContractId ProtocolCircuitBreaker
  └── choice ResumeSettlements : ContractId ProtocolCircuitBreaker
```

---

## 5. Verification & Acceptance Testing Gates

All changes, extensions, or refactors must satisfy the following automated acceptance gates (enforced via `npm test` in `backend/`):

1. **`testAtomicSwap`:** Multi-party swap executes in 1 atomic transaction.
2. **`testAtomicRevert`:** Forced failure in one leg causes 100% rollback with zero partial balance.
3. **`testAuditorCannotSeeLegs` (The "Money Shot"):** Regulator ACS contains `SettlementReceipt` and strictly 0 token contracts (`visibleTokens == []`).
4. **`testGovernedBelowThreshold`:** Governed deal fails to execute with < M signatures.
5. **`testGovernedAtThreshold`:** Governed deal succeeds upon reaching M signatures.
6. **`testEmergencyVeto`:** Governor can unilaterally abort a pending deal if suspicious activity is detected.
7. **`testCircuitBreaker`:** Global circuit breaker prevents settlements when triggered.

---

## 6. References & Engineering Guides

- Contributor Onboarding: [CONTRIBUTING.md](file:///c:/Users/user/Desktop/Composition-Protocol/CONTRIBUTING.md)
- Complete Risk Audit: [docs/RISK_ASSESSMENT.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/RISK_ASSESSMENT.md)
- Architecture Blueprint: [docs/ARCHITECTURE.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/ARCHITECTURE.md)
- HackCanton Judging Guide: [docs/JUDGING.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/JUDGING.md)

