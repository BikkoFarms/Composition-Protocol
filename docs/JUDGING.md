# HackCanton Season 3 — Judging & Evaluation Guide

This guide assists judges in evaluating **Settle Flow** against HackCanton Season 3's official criteria and prize categories.

**Team:** Revotoken Africa  
**Primary Track:** Track 1 (RWA & Business Workflows)  
**Secondary Challenge:** BitSafe Decentralization Challenge (contribution-pool / LocalNet target)  
**Live Submission Window:** September 18 – October 9, 2026  
**Positioning (what already exists vs Settle Flow):** [POSITIONING.md](./POSITIONING.md)  
**Video / pitch walkthrough (current desks):** [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)  
**Grofty:** Deferred (P3) — do not contort the architecture for wallet signing this sprint.


> **Honest scope (please read first).** The hosted site runs in **demo mode**: an in-memory engine that mirrors the Daml contracts' rules; it is not connected to a Canton ledger (`/health` → `"mode":"demo"`). The **Daml contracts** are the ledger implementation and are proven by 27 Daml Script tests (`cd daml && daml test`), including ledger-enforced BitSafe governance (governor-signed approvals; governed deals cannot skip governance), circuit breaker and veto. Tokens are **mocks** shaped like CIP-56 holdings. Counterparties on a deal see all its legs; the regulator sees only the receipt.

---

## 1. Quick Judge Walkthrough (Under 3 Minutes)

Full timed script with voiceover: **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)**. Short path:

1. **Start the Stack (Demo Mode):**
   ```bash
   # Terminal 1: API (:4000)
   cd backend && npm run dev
   # Terminal 2: Web App (:3100)
   cd frontend && npm run dev
   ```
2. **Exporter proposes (`/proposer`):**
   - Trade dropdown → **Cocoa export finance** → **Propose trade**.
   - Exporter cannot settle — only propose / cancel.
3. **Lender + Oracle sign (`/counterparty`):**
   - **Accept as Lender** → switch to Oracle → **Accept as Oracle**.
4. **Allocation matching + atomic settle (`/demo`):**
   - Select the signed cocoa trade.
   - **Try wrong amount** on the cash leg → refused, leg stays unlocked.
   - **Lock as Alice / Bob / Oracle** → **Settle all 3 legs at once**.
5. **Money shot (`/observer`):**
   - Lender tokens vs regulator **`visibleTokens: []`** + receipt.
6. **BitSafe (`/governance`):**
   - Pre-stage a **Gold doré** trade with BitSafe ticked (see DEMO_SCRIPT prep).
   - **Approve as Gov1** → **Try to execute with 1 of 2** (refused) → **Approve as Gov2** → **Execute settlement**.
7. **Metrics (`/metrics`):**
   - **Run 50 settlements** once for load evidence.

---

## 2. Alignment with HackCanton Season 3 Track 1: RWA & Business Workflows

| Track 1 Pillar | Official HackCanton Focus | Settle Flow Implementation | Verification Reference |
| :--- | :--- | :--- | :--- |
| **1. Issuance** | Tokenization of RWAs, registry models, CIP-0056. | `ComposableAsset` wrapping commodities and sponsor assets (**CBTC, USDCx, cETH**). Treasury mint via Admin. | [ComposableAsset.daml](../daml/daml/ComposableAsset.daml), [admin.ts](../backend/src/routes/admin.ts) |
| **2. Transfers** | Multi-asset exchange, atomic DvP/PvP. | Single-transaction multi-leg settlement (`R-ATOM-1/2`). | [Composition.daml](../daml/daml/Composition.daml) |
| **3. State Changes** | Lifecycle from origination to fulfillment/cancel. | Propose → accept → **allocate (match)** → settle → receipt; optional BitSafe. Cancel / expire / reject / mismatch reject. | [Composition.daml](../daml/daml/Composition.daml), [PROTOCOL.md](PROTOCOL.md) |
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

| Criterion | How Settle Flow Excels |
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
