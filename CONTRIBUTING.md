# Contributing to Settle Flow

Welcome to **Settle Flow**! This guide is for any engineer, architect, or contributor joining the repository. It outlines our architectural philosophy, what has been built, what remains on the roadmap, potential risks, and the rules of engagement.

---

## 1. Quick Onboarding & Architecture Map

Settle Flow is an atomic, private, multi-asset settlement primitive built on Canton for **HackCanton Season 3** (Track 1: RWA & Business Workflows primary; BitSafe Decentralization Challenge secondary).

```
Composition-Protocol/
├── daml/                   # Daml 3.x smart contracts (ComposableAsset, Composition, Governance)
├── backend/                # Express API gateway & Canton JSON Ledger API v2 bridge (:4000)
│   ├── src/
│   │   ├── index.ts        # Server entry & router mounting
│   │   ├── ledger.ts       # Canton Ledger API v2 & Keycloak OIDC client
│   │   ├── demoStore.ts    # High-fidelity ACS simulation & state machine
│   │   ├── demoStore.test.ts # 20 automated test suites
│   │   └── routes/         # Assets, Compositions, Governance, Audit, Admin
├── frontend/               # Next.js 15 App Router web application (:3000)
│   ├── app/
│   │   ├── page.tsx        # Keynote landing showcase
│   │   ├── demo/           # 5-minute interactive pitch demo runner
│   │   ├── proposer/       # Exporter (Alice) console
│   │   ├── counterparty/   # Lender (Bob) & Oracle co-signing portal
│   │   ├── observer/       # Regulator / Auditor "Money Shot" view
│   │   ├── governance/     # BitSafe 2-of-3 threshold multi-sig room
│   │   ├── metrics/        # Live protocol telemetry & audit stream
│   │   └── admin/          # Principal Engineer Mission Control
│   └── lib/api.ts          # Type-safe API client
├── mocks/oracle/           # Live Commodity Oracle & Cryptographic Attestation service (:4002)
├── scripts/                # OIDC token acquisition and utility scripts
├── docs/                   # Full documentation suite
└── .ai/                    # AI engineering environment, rules, and skills
```

---

## 2. Status Matrix: What Has Been Done vs. What Hasn't

### What HAS Been Built (and how it is proven)

Two layers are tested separately: **Daml Script** tests prove the contracts; **Node** tests prove the in-memory demo engine that the hosted site runs. The hosted site is **not** connected to a Canton ledger.

| Feature / Subsystem | Status | Proof |
| :--- | :---: | :--- |
| **Daml Smart Contracts** | Complete | [Composition.daml](daml/daml/Composition.daml), [Governance.daml](daml/daml/Governance.daml), [ComposableAsset.daml](daml/daml/ComposableAsset.daml), [MockToken.daml](daml/daml/MockToken.daml) — 27/27 Daml Script tests (`cd daml && daml test`). |
| **Single-Tx Atomicity (`R-ATOM-1/2`)** | Ledger-enforced | All legs transfer in one transaction; a failed leg aborts all (`testAtomicSwap`, `testAtomicRevert`). |
| **Allocation Matching (`R-ALLOC`)** | Ledger-enforced | Every pledge is matched field by field and re-checked against the live asset at settle (`testAllocHappyPath3PartyDvp`, partial / withdrawn / unauthorized tests). Note: an allocation does not lock the asset; if the provider moves it, settlement reverts. |
| **Regulator-Blind Receipts (`R-PRIV-3`)** | Ledger-enforced | Regulator ACS holds `SettlementReceipt` only, no tokens, amounts or asset IDs (`testAuditorCannotSeeLegs`). Counterparties on a deal *do* see every leg's terms. |
| **BitSafe M-of-N Governance (`R-GOV-1/2`)** | Ledger-enforced | Approvals are governor-signed `GovernorApproval` contracts; governed agreements settle only via `SettleGoverned` at threshold (`testGovernedBelowThreshold`, `testGovernedAtThreshold`, `testGovernedCannotSkipGovernance`, `testOperatorCannotForgeApproval`, `testDuplicateApprovalCountsOnce`). |
| **Emergency Veto** | Ledger-enforced | Any one governor's veto archives the agreement; it cannot be settled afterwards (`testEmergencyVeto`). |
| **Circuit Breaker** | Ledger-enforced | Every settle path checks the live breaker (co-signed by operator + governors) and aborts while halted (`testCircuitBreaker`, `testHaltedBreakerBlocksSettle`). |
| **Proposal lifecycle** | Ledger-enforced | Cancelled, rejected or expired proposals cannot become agreements (`testCancelledProposalCannotFinalize`, `testExpiredProposalCannotFinalize`). |
| **Deal Digests & LTV** | Demo engine | SHA-256 deal hash and collateral cover computed in `demoStore.ts` (off-ledger). |
| **Canton JSON Ledger API v2 Client** | Implemented, not hosted | [backend/src/ledger.ts](backend/src/ledger.ts) / [ledgerWorkflow.ts](backend/src/ledgerWorkflow.ts): `/v2/commands/submit-and-wait`, ACS queries, Keycloak OIDC. Not exercised by the hosted demo. |
| **Mission Control Admin Console** | Complete | [frontend/app/admin/page.tsx](frontend/app/admin/page.tsx): latency ping, mode display, treasury minting (demo), state resets. |
| **Commodity Oracle** | Mock | [mocks/oracle/server.mjs](mocks/oracle/server.mjs): simulated spot prices and HMAC-SHA256 signed inspection certificates. |
| **Demo-engine Test Gates** | 42/42 passing | `cd backend && npm test` |
| **Smoke test** | 17/17 passing | `npm run test:smoke` against a running API |
| **Frontend Production Build** | Passing | `npm run build` |
| **Operational Manuals** | Complete | [DEPLOYMENT.md](DEPLOYMENT.md) & [TESTING.md](TESTING.md) |

---

### What HAS NOT Been Done (Future Production Roadmap)

| Roadmap Item | Priority | Target Milestone | Description |
| :--- | :---: | :---: | :--- |
| **Host the demo on a Canton ledger** | High | Post-Hackathon v1.0 | Run the hosted backend in `ledger` mode against a DevNet participant with the DAR uploaded (Mode C). |
| **Real CIP-56 assets** | High | Post-Hackathon v1.0 | Replace `MockToken` with Splice token-standard holdings / allocations (today they are mocks behind a CIP-56-shaped interface). |
| **Per-leg privacy between counterparties** | Medium | Post-Hackathon v1.1 | Today every counterparty observes the whole agreement (all leg amounts); split disclosure per leg. |
| **Asset locking on allocation** | Medium | Post-Hackathon v1.1 | Lock the pledged holding when a leg is allocated (today settlement re-checks the live asset and reverts if it moved). |
| **Wallet (CIP-103) & 5N ID KYC** | Medium | Post-Hackathon v1.1 | The navbar identity panel is simulated; integrate real wallet connection and KYC credentials. |
| **Hardware Security Module (HSM) KMS Signer** | High | Post-Hackathon v1.1 | Integrate AWS KMS / Vault for institutional party signing keys rather than software OIDC passwords. |
| **Dynamic Canton Sequencer Failover** | Medium | Post-Hackathon v1.2 | Multi-sequencer Canton domain client to automatically route around degraded sequencer nodes. |
| **Formal Property-Based Daml Verification** | Medium | Post-Hackathon v1.2 | QuickCheck / Daml property tests for unbounded multi-leg permutations ($>10$ legs). |
| **On-Chain Legal Agreement Wrapper** | Low | Post-Hackathon v2.0 | Standardized ISDA/EFET Master Agreement hash anchoring in `WorkflowProposal`. |
| **Native Mobile App (iOS / Android)** | Low | Post-Hackathon v2.0 | React Native companion app for field commodity warehouse inspectors. |

---

## 3. Engineering Rules & Invariants (Must Never Be Broken)

When writing code or submitting Pull Requests, every contributor must uphold the **Core Protocol Invariants**:

1. **`R-ATOM-1` (Single Transaction Settlement):**
   All asset transfers in a deal must execute inside a single Daml transaction choice (`WorkflowAgreement.Settle`, `SettleWithRegulator` or `SettleGoverned`, via `runSettlement`). Never split transfers across multiple asynchronous transactions.
2. **`R-ATOM-2` (Zero Half-States):**
   If any leg fails (due to insufficient balance, spent contract, or invalid controller), the entire transaction must abort and revert cleanly. Counterparties must retain their original assets.
3. **`R-PRIV-3` (Observer Scoping / The Money Shot):**
   Visibility is enforced via Canton `signatory` and `observer` boundaries. Counterparties on a deal observe all its legs; only the regulator is blinded. The regulator's Active Contract Set (ACS) must contain the `SettlementReceipt` and **strictly 0 token contracts (`visibleTokens: []`)**. Never use UI-layer filtering as a privacy mechanism.
4. **`R-GOV-1/2` (BitSafe M-of-N Governance):**
   Governed agreements must settle only through `SettleGoverned`, which counts distinct governor-signed `GovernorApproval` contracts: reject below threshold $M$, execute atomically at $M$. Never let the operator record approvals on a governor's behalf.
5. **Dual-Mode Graceful Fallback:**
   The backend must support both Live Canton Ledger mode (`LEDGER_MODE=ledger`) and the local high-fidelity engine (`demoStore`) for instant offline testing.

---

## 4. Pre-Commit Checklist & Verification Workflow

Before pushing any commit to `main` or opening a PR (see [TESTING.md](TESTING.md)):

```bash
# 1. Automated Test Suite (Must pass all 20 suites)
npm test

# 2. Live E2E Integration Suite (Must pass all 13 tests)
npm run test:e2e

# 3. Production Build & Route Prerendering (Must compile cleanly)
npm run build

# 4. Check Git Status (Ensure working tree is clean)
git status
```

---

## 5. Risk Assessment Summary

A comprehensive risk audit is maintained in [docs/RISK_ASSESSMENT.md](docs/RISK_ASSESSMENT.md).

- **What is NOT at Risk:** Settlement atomicity, cryptographic sub-transaction privacy, and governance threshold enforcement are guaranteed by Daml and Canton consensus mathematics.
- **What IS at Risk:** Remote sequencer latency, Keycloak OIDC token expiration, and physical warehouse inspection oracle integrity. All are actively mitigated through proactive token caching, emergency circuit breakers, and cryptographic attestation signatures.
