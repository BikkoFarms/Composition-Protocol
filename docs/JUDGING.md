# HackCanton Season 3 — Judging & Evaluation Guide

This guide assists judges in evaluating the **Settleflow** (Settleflow) against HackCanton Season 3's official criteria and prize categories.

**Team:** Revotoken Africa  
**Primary Track:** Track 1 (RWA & Business Workflows)  
**Secondary Challenge:** BitSafe Decentralization Challenge (contribution-pool / LocalNet target)  
**Live Submission Window:** September 18 – October 9, 2026  
**Grofty:** Deferred (P3) — do not contort the architecture for wallet signing this sprint.

---

## 1. Quick Judge Walkthrough (Under 3 Minutes)

1. **Start the Stack (Demo Mode):**
   ```bash
   # Terminal 1: API (:4000)
   cd backend && npm run dev
   # Terminal 2: Web App (:3100 locally, or :3000)
   cd frontend && npm run dev
   ```
2. **Initiate / Settle DvP:**
   - Open `/demo`.
   - Click **Initiate / Settle DvP**: Propose → AcceptanceTracker co-sign → atomic settlement (CBTC + USDCx + cETH).
   - Optional: **Atomic revert** to witness zero partial state (`R-ATOM-2`).
3. **Money shot (observer sees nothing):**
   - Open `/observer` (or click **Prove money shot** after settle).
   - Click **Settle then prove** if the ACS is empty.
   - Split-screen: participant query shows tokens; regulator query shows **`visibleTokens: []`** plus `SettlementReceipt` (`R-PRIV-3`, `testAuditorCannotSeeLegs`).
4. **BitSafe refuse → settle:**
   - Open `/governance`.
   - Click **Camera beat: refuse → settle** (or manually: Open governed deal → Sign Gov1 → Try execute early → Sign Gov2 → Execute).
   - Witness `R-GOV-1` refusal below threshold, then `R-GOV-2` settle at 2-of-3.
5. **Metrics evidence:**
   - Open `/metrics` or use **Settle 50 tickets** on `/demo`.

---

## 2. Alignment with HackCanton Season 3 Track 1: RWA & Business Workflows

| Track 1 Pillar | Official HackCanton Focus | Settleflow Implementation | Verification Reference |
| :--- | :--- | :--- | :--- |
| **1. Issuance** | Tokenization of RWAs, registry models, CIP-0056. | `ComposableAsset` wrapping commodities and sponsor assets (**CBTC, USDCx, cETH**). Treasury mint via Admin. | [ComposableAsset.daml](../daml/daml/ComposableAsset.daml), [admin.ts](../backend/src/routes/admin.ts) |
| **2. Transfers** | Multi-asset exchange, atomic DvP/PvP. | Single-transaction multi-leg settlement (`R-ATOM-1/2`). | [Composition.daml](../daml/daml/Composition.daml) |
| **3. State Changes** | Lifecycle from origination to fulfillment/cancel. | Propose → accept → agree → optional BitSafe gate → receipt. Cancel / expire / reject included. | [Composition.daml](../daml/daml/Composition.daml), [PROTOCOL.md](PROTOCOL.md) |
| **4. Audit Workflows** | Compliance receipts + privacy. | Observer money shot: regulator ACS has receipt only (`visibleTokens: []`). | [demoStore.ts](../backend/src/demoStore.ts), `/observer` |
| **5. Organizational Ops** | Mission control / safety. | Admin portal, ledger ping, mode switch, circuit breaker. | `/admin`, [RISK_ASSESSMENT.md](RISK_ASSESSMENT.md) |

**Positioning for judges:** The product is a **reusable Daml settlement-workflow package**. The 3-party DvP is the demo face — not a consumer venue. RFQ desks and exchanges are potential *callers* of this layer.

---

## 3. BitSafe Decentralization Challenge Entry

- **Primary target:** Contribution pool (LocalNet / reproducible demo).
- **Contract:** [`Governance.daml:GovernedSettlement`](../daml/daml/Governance.daml) — 2-of-3, `EmergencyVeto`, circuit breaker.
- **Evidence:** Backend `R-GOV-1` / `R-GOV-2` gates; UI **Camera beat: refuse → settle** on `/governance`.
- **Assets:** CBTC as collateral leg; judging focuses on the decentralization model.

---

## 4. Judging Matrix Alignment

| Criterion | How Settleflow Excels |
| :--- | :--- |
| **1. Value** | Removes repeated propose/accept/disclose/expiry/settle plumbing. |
| **2. ICP** | Builders (venues calling the package) and trade-finance operators. |
| **3. Metrics** | ≥50 settlements; interviews in [INTERVIEWS.md](INTERVIEWS.md). |
| **4. GTM** | Open-source primitive; venues adopt as settlement layer. |
| **5. MVP** | Daml 3.x, JSON Ledger API v2, Lattice desks, automated gates. |
| **6. Pitch** | Money shot + BitSafe refuse→settle; [PITCH_SCRIPT.md](PITCH_SCRIPT.md). |

---

## 5. Pre-Existing Code Disclosure

- Baseline templates predating **September 18, 2026** are disclosed in the repository root.
- Delivery-phase work (Sept 18 – Oct 9, 2026) is the scored window.
- See [CONTRIBUTING.md](../CONTRIBUTING.md) and [RISK_ASSESSMENT.md](RISK_ASSESSMENT.md).
