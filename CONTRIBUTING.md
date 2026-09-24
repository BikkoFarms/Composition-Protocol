# Contributing to Composition Protocol

Welcome to **Composition Protocol**! This guide is for any engineer, architect, or contributor joining the repository. It outlines our architectural philosophy, what has been built, what remains on the roadmap, potential risks, and the rules of engagement.

---

## 1. Quick Onboarding & Architecture Map

Composition Protocol is an atomic, private, multi-asset settlement primitive built on Canton for **HackCanton Season 3** (Track 1: RWA & Business Workflows primary; BitSafe Decentralization Challenge secondary).

```
Composition-Protocol/
├── daml/                   # Daml 3.x smart contracts (ComposableAsset, Composition, Governance)
├── backend/                # Express API gateway & Canton JSON Ledger API v2 bridge (:4000)
│   ├── src/
│   │   ├── index.ts        # Server entry & router mounting
│   │   ├── ledger.ts       # Canton Ledger API v2 & Keycloak OIDC client
│   │   ├── demoStore.ts    # High-fidelity ACS simulation & state machine
│   │   ├── demoStore.test.ts # 11 automated test suites
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

### What HAS Been Built and Verified (Production Ready)

| Feature / Subsystem | Status | Verification Gate |
| :--- | :---: | :--- |
| **Daml Smart Contracts** | Complete | [Composition.daml](daml/daml/Composition.daml), [Governance.daml](daml/daml/Governance.daml), [ComposableAsset.daml](daml/daml/ComposableAsset.daml), [MockToken.daml](daml/daml/MockToken.daml) |
| **Single-Tx Atomicity (`R-ATOM-1/2`)** | Complete | Verified: All transfer legs execute in 1 transaction; failed legs abort with zero half-states (`testAtomicSwap`, `testAtomicRevert`). |
| **Canton Sub-Transaction Privacy (`R-PRIV-1/2/3`)** | Complete | Verified: Regulator Active Contract Set contains `visibleTokens: []` and only `SettlementReceipt` (`testAuditorCannotSeeLegs`). |
| **BitSafe M-of-N Governance (`R-GOV-1/2`)** | Complete | Verified: 2-of-3 committee rejects below threshold and executes once threshold is met (`testGovernedBelowThreshold`, `testGovernedAtThreshold`). |
| **Institutional Safety (Veto & Circuit Breaker)** | Complete | Verified: `EmergencyVeto` choice allows governors to abort deals; `ProtocolCircuitBreaker` pauses settlements during halts. |
| **Cryptographic Deal Digests & LTV Engine** | Complete | Verified: 64-char SHA-256 deal hash computed for every deal; automated LTV and 1300% collateral coverage calculation. |
| **Canton JSON Ledger API v2 Client** | Complete | [backend/src/ledger.ts](backend/src/ledger.ts) handles `/v2/commands/submit-and-wait`, active-contracts queries, and Keycloak OIDC caching. |
| **Mission Control Admin Console** | Complete | [frontend/app/admin/page.tsx](frontend/app/admin/page.tsx) with live latency ping, mode toggles, treasury minting, and state resets. |
| **Commodity Oracle & Attestation Service** | Complete | [mocks/oracle/server.mjs](mocks/oracle/server.mjs) serving dynamic spot prices and HMAC-SHA256 signed inspection certificates. |
| **Automated Test Gates** | 11/11 Passing | `cd backend && npm test` passing in 551ms. |
| **Frontend Production Build** | 11/11 Static Routes | `cd frontend && npm run build` compiled with 0 errors. |

---

### What HAS NOT Been Done (Future Production Roadmap)

| Roadmap Item | Priority | Target Milestone | Description |
| :--- | :---: | :---: | :--- |
| **Hardware Security Module (HSM) KMS Signer** | High | Post-Hackathon v1.1 | Integrate AWS KMS / Vault for institutional party signing keys rather than software OIDC passwords. |
| **Dynamic Canton Sequencer Failover** | Medium | Post-Hackathon v1.2 | Multi-sequencer Canton domain client to automatically route around degraded sequencer nodes. |
| **Formal Property-Based Daml Verification** | Medium | Post-Hackathon v1.2 | QuickCheck / Daml property tests for unbounded multi-leg permutations ($>10$ legs). |
| **On-Chain Legal Agreement Wrapper** | Low | Post-Hackathon v2.0 | Standardized ISDA/EFET Master Agreement hash anchoring in `CompositionProposal`. |
| **Native Mobile App (iOS / Android)** | Low | Post-Hackathon v2.0 | React Native companion app for field commodity warehouse inspectors. |

---

## 3. Engineering Rules & Invariants (Must Never Be Broken)

When writing code or submitting Pull Requests, every contributor must uphold the **Core Protocol Invariants**:

1. **`R-ATOM-1` (Single Transaction Settlement):**
   All asset transfers in a deal must execute inside a single Daml transaction choice (`CompositionAgreement.Settle` or `SettleWithRegulator`). Never split transfers across multiple asynchronous transactions.
2. **`R-ATOM-2` (Zero Half-States):**
   If any leg fails (due to insufficient balance, spent contract, or invalid controller), the entire transaction must abort and revert cleanly. Counterparties must retain their original assets.
3. **`R-PRIV-1/2/3` (Observer Scoping / The Money Shot):**
   Privacy is enforced via Canton `signatory` and `observer` boundaries. The regulator's Active Contract Set (ACS) must contain the `SettlementReceipt` and **strictly 0 token contracts (`visibleTokens: []`)**. Never use UI-layer filtering as a privacy mechanism.
4. **`R-GOV-1/2` (BitSafe M-of-N Governance):**
   Governed settlements must strictly reject execution if approved signatures are less than threshold $M$, and execute atomically once the threshold is satisfied.
5. **Dual-Mode Graceful Fallback:**
   The backend must support both Live Canton Ledger mode (`LEDGER_MODE=ledger`) and the local high-fidelity engine (`demoStore`) for instant offline testing.

---

## 4. Pre-Commit Checklist & Verification Workflow

Before pushing any commit to `main` or opening a PR:

```bash
# 1. Backend Strict Typecheck
cd backend
npm run typecheck

# 2. Automated Test Suite (Must pass all 11 suites)
npm test

# 3. Frontend Production Build & Route Prerendering (Must pass 11/11 routes)
cd ../frontend
npm run build

# 4. Check Git Status (Ensure working tree is clean)
git status
```

---

## 5. Risk Assessment Summary

A comprehensive risk audit is maintained in [docs/RISK_ASSESSMENT.md](docs/RISK_ASSESSMENT.md).

- **What is NOT at Risk:** Settlement atomicity, cryptographic sub-transaction privacy, and governance threshold enforcement are guaranteed by Daml and Canton consensus mathematics.
- **What IS at Risk:** Remote sequencer latency, Keycloak OIDC token expiration, and physical warehouse inspection oracle integrity. All are actively mitigated through proactive token caching, emergency circuit breakers, and cryptographic attestation signatures.
