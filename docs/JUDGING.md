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

## 2. Alignment with HackCanton Judging Criteria

| Criterion | HackCanton Standard | How Composition Protocol Wins |
|:---|:---|:---|
| **1. Value / Problem** | Solves an acute, unaddressed pain point with high network utility. | Solves the missing **composition layer** between CIP-0056 tokenization and structured finance. Eliminates the need for DEXs and lending protocols to hand-roll custom atomic multi-leg logic. |
| **2. ICP / Audience** | Clear, dual persona with demonstrated business demand. | **Builders:** DEXs/lending pools (Temple Digital, Tradecraft, Ekiden) calling the shared primitive.<br>**Operators:** African commodity trade finance facilities needing private funding against warehouse receipts. |
| **3. Metrics / Validation** | Quantitative evidence, transaction volume, and user validation. | **≥50 settlements** benchmarked on-chain with zero unexpected failures; average legs per deal, success/revert rates instrumented in real-time on `/metrics`. |
| **4. Go-To-Market (GTM)** | Realistic distribution strategy and network effects. | Open-source primitive (Apache-2.0); adoption by Canton venues. Each deal settling on the protocol generates recurrent network activity and fee volume. |
| **5. MVP / Technical Excellence** | Functioning code, automated tests, clean architecture, and Canton-native features. | 4 Daml 3.x smart contracts, CIP-0056 interface, Canton JSON Ledger API v2 bridge with Keycloak OIDC, Next.js 15 UI, and **6/6 passing automated test gates**. |
| **6. Pitch / Demo** | Clear problem→solution narrative with verifiable proof. | The **Observer "Money Shot"**: proving cryptographic privacy directly through Canton's Active Contract Set (`visibleTokens: []`), not a UI filter. |

---

## 3. BitSafe Decentralization Challenge Entry

- **Challenge Category:** Secondary Entry (50,000 CC pool)
- **Problem Solved:** High-value multi-asset settlements should not be triggered by a single administrator key.
- **Implementation:**
  - Contract: [`Governance.daml:GovernedSettlement`](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/Governance.daml#L10-L48)
  - UI Dashboard: [http://localhost:3000/governance](http://localhost:3000/governance)
  - Automated Tests: [`TestGovernance.daml`](file:///c:/Users/user/Desktop/Composition-Protocol/daml/daml/TestGovernance.daml), `demoStore.test.ts` (tests 4 & 5).
  - Reproducibility: Fully executable on LocalNet and offline demo store with zero external node requirements.

---

## 4. Pre-Existing Code Disclosure

In accordance with HackCanton Season 3 delivery-phase guidelines:
- Any baseline templates predating **September 18, 2026** are disclosed in the repository root.
- The delivery-phase commit series (Sept 18 – Oct 9, 2026) encompasses the complete architectural integration: Daml contracts, JSON Ledger API v2 client, Keycloak OIDC authentication, BitSafe governance, and the Next.js 15 web application.
