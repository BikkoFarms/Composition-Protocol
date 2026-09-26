# HackCanton Season 3 — Judging & Evaluation Guide

This guide assists judges in evaluating the **Composition Protocol** against HackCanton Season 3's official criteria and prize categories.

**Team:** Revotoken Africa  
**Primary Track:** Track 1 (RWA & Business Workflows)  
**Secondary Challenge:** BitSafe Decentralization Challenge  
**Live Submission Window:** September 18 – October 9, 2026

---

## 1. Quick Judge Walkthrough (Under 3 Minutes)

Experience the full protocol in three simple steps:

1. **Start the Stack (or run in Demo Mode):**
   ```bash
   # Terminal 1: API
   cd backend && npm run dev
   # Terminal 2: Web App
   cd frontend && npm run dev
   ```
2. **One-Click Pitch Demo:**
   - Navigate to [http://localhost:3000/demo](http://localhost:3000/demo).
   - Click **"Run full happy path"**: Watch Proposal → AcceptanceTracker co-signing → Atomic Single-Transaction Settlement.
   - Click **"Run atomic revert"**: Forces Leg 2 failure; witness 100% rollback with zero partial state (`R-ATOM-2`).
3. **The "Money Shot" Privacy Verification:**
   - Open [http://localhost:3000/observer](http://localhost:3000/observer).
   - Notice the side-by-side comparison:
     - Participant (Bob) sees `tokens: 2` and contract IDs.
     - Regulator/Observer screen provably displays **`visibleTokens: []`** while the `SettlementReceipt` is present (`R-PRIV-3`).
4. **BitSafe Decentralization Challenge ($M$-of-$N$):**
   - Open [http://localhost:3000/governance](http://localhost:3000/governance).
   - Click **"⚡ Run 1-Click R-GOV-1 & R-GOV-2 Test Flow"**:
     - Automatically verifies `R-GOV-1` rejection at 1/2 signatures.
     - Automatically verifies `R-GOV-2` atomic execution at 2/2 signatures.
5. **Metrics Evidence:**
   - Open [http://localhost:3000/metrics](http://localhost:3000/metrics).
   - Click **"Run 50 settlements"**: Instantly burns 50 verifiable settlement transactions with real-time analytics.

---

## 2. Alignment with HackCanton Season 3 Track 1: RWA & Business Workflows

HackCanton Season 3 Track 1 evaluates solutions across five critical business workflow dimensions:

| Track 1 Pillar | Official HackCanton Focus | Composition Protocol Implementation | Verification Reference |
| :--- | :--- | :--- | :--- |
| **1. Issuance** | Tokenization of real-world assets, registry models, and CIP-0056 compliance. | Standardized `ComposableAsset` interface wrapping physical commodities (Cocoa, Coffee) and crypto collateral (CBTC, USDCx). Direct treasury minting via Admin console (`POST /admin/mint`). | [ComposableAsset.daml](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/ComposableAsset.daml)<br>[admin.ts](file:///c:/Users/user/Desktop/Composition-Protocol/backend/src/routes/admin.ts) |
| **2. Transfers** | Multi-asset exchange, clearing, and atomic DvP/PvP settlement. | Single-transaction multi-leg settlement (`R-ATOM-1/2`). All asset transfers happen inside one atomic Daml choice. If any leg fails, the entire deal reverts with zero partial balances. | [Composition.daml](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/Composition.daml)<br>`testAtomicSwap` & `testAtomicRevert` |
| **3. State Changes** | Formal lifecycle transitions from origination to fulfillment or cancellation. | Comprehensive state machine: `CompositionProposal` $\to$ `AcceptanceTracker` $\to$ `CompositionAgreement` $\to$ `GovernedSettlement` $\to$ `SettlementReceipt`. Supports Proposer withdrawal (`CancelProposal`) and Operator abort (`CancelAgreement`). | [Composition.daml](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/Composition.daml)<br>[PROTOCOL.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/PROTOCOL.md) |
| **4. Audit Workflows** | Regulatory compliance, immutable receipts, and zero-knowledge privacy. | The **Observer "Money Shot" (`R-PRIV-1/2/3`)**: Regulators query Canton's Active Contract Set (ACS) and see an immutable `SettlementReceipt` with **strictly zero token disclosure (`visibleTokens: []`)**. Proves compliance without leaking trade secrets. | [demoStore.ts](file:///c:/Users/user/Desktop/Composition-Protocol/backend/src/demoStore.ts#L430-L460)<br>[/observer](http://localhost:3000/observer) |
| **5. Organizational Operations** | Operational safety, enterprise administration, and mission control. | Mission Control Admin Portal (`/admin`), live node latency diagnostic (`/admin/ledger/ping`), dynamic runtime ledger mode switching (`/admin/ledger/mode`), and emergency protocol pause. | [admin/page.tsx](file:///c:/Users/user/Desktop/Composition-Protocol/frontend/app/admin/page.tsx)<br>[RISK_ASSESSMENT.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/RISK_ASSESSMENT.md) |

---

## 3. BitSafe Decentralization Challenge Entry (50,000 CC Pool)

BitSafe is hosting the **Decentralization Challenge** at HackCanton Season 3 to eliminate single points of failure in Canton applications by creating **Decentralized Parties**:

- **Track Compatibility:**
  - **Track 1: Open Source (LocalNet):** Fully reproducible out of the box using our offline demo engine and Docker Compose workflows with zero external node requirements.
  - **Track 2: Node Track (DevNet):** Fully integrated with the shared HackCanton DevNet participant node (`https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services`) and Keycloak OIDC.
- **Decentralized Party Architecture:**
  - Contract: [`Governance.daml:GovernedSettlement`](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/Governance.daml#L10-L48)
  - Eliminates single-admin vulnerability in high-value trade finance deals by enforcing an $M$-of-$N$ (2-of-3) threshold signature committee across independent operators.
  - **Emergency Governor Veto:** Any individual governor can exercise `EmergencyVeto` to cancel a pending settlement immediately upon detecting malicious counterparty actions.
  - **Protocol Circuit Breaker:** Admin/Committee can pause all settlement choices globally via `ProtocolCircuitBreaker`.
  - **Automated Verification:** Verified in tests 4, 5, 10, and 11 of [demoStore.test.ts](file:///c:/Users/user/Desktop/Composition-Protocol/backend/src/demoStore.test.ts) (`R-GOV-1`, `R-GOV-2`, `EmergencyVeto`, `CircuitBreaker`).
- **Interactive UI Portal:** Testable via [http://localhost:3000/governance](http://localhost:3000/governance) with a 1-click test runner.

---

## 4. HackCanton Season 3 Judging Matrix Alignment

| Criterion | HackCanton Standard | How Composition Protocol Excels |
| :--- | :--- | :--- |
| **1. Value / Problem** | Solves an acute, unaddressed pain point with high network utility. | Solves the missing **composition layer** between CIP-0056 tokenization and structured finance. Eliminates the need for DEXs and lending protocols to hand-roll custom atomic multi-leg logic. |
| **2. ICP / Audience** | Clear, dual persona with demonstrated business demand. | **Builders:** DEXs/lending pools (Temple Digital, Tradecraft, Ekiden) calling the shared primitive.<br>**Operators:** African commodity trade finance facilities needing private funding against warehouse receipts. |
| **3. Metrics / Validation** | Quantitative evidence, transaction volume, and user validation. | **≥50 settlements** benchmarked on-chain with zero unexpected failures; average legs per deal, success/revert rates instrumented in real-time on `/metrics`.<br>**Builder Demand:** 3 detailed builder interviews logged in [docs/INTERVIEWS.md](INTERVIEWS.md) confirming 100% consensus on custom escrow pain and willingness to pay 2–5 bps per deal. |
| **4. Go-To-Market (GTM)** | Realistic distribution strategy and network effects. | Open-source primitive (Apache-2.0); adoption by Canton venues. Each deal settling on the protocol generates recurrent network activity and fee volume. |
| **5. MVP / Technical Excellence** | Functioning code, automated tests, clean architecture, and Canton-native features. | 4 Daml 3.x smart contracts, CIP-0056 interface, Canton JSON Ledger API v2 bridge with Keycloak OIDC, Next.js 15 UI, **11/11 passing automated test gates**, and **11/11 prerendered frontend routes**. |
| **6. Pitch / Demo** | Clear problem→solution narrative with verifiable proof. | The **Observer "Money Shot"**: proving cryptographic privacy directly through Canton's Active Contract Set (`visibleTokens: []`), not a UI filter.<br>**Pitch Script:** Timed 3-minute video script with screen cues and voiceover in [docs/PITCH_SCRIPT.md](PITCH_SCRIPT.md). |

---

## 5. Pre-Existing Code Disclosure & Contribution Rules

In accordance with HackCanton Season 3 delivery-phase guidelines:
- Any baseline templates predating **September 18, 2026** are disclosed in the repository root.
- The delivery-phase commit series (Sept 18 – Oct 9, 2026) encompasses the complete architectural integration: Daml contracts, JSON Ledger API v2 client, Keycloak OIDC authentication, BitSafe governance, live cryptographic Oracle service, Mission Control admin console, and the Next.js 15 web application.
- Comprehensive contributor instructions, invariant rules, and risk evaluations are documented in [CONTRIBUTING.md](file:///c:/Users/user/Desktop/Composition-Protocol/CONTRIBUTING.md) and [docs/RISK_ASSESSMENT.md](file:///c:/Users/user/Desktop/Composition-Protocol/docs/RISK_ASSESSMENT.md).

