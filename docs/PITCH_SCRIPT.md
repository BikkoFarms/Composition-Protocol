# Settle Flow — HackCanton Season 3 Video Pitch Script & Judge Guide

**Duration:** Under 3 minutes (Target: 175 seconds)  
**Track:** Track 1: Real-World Assets (RWA) & Business Workflows  
**Challenge:** BitSafe Decentralization Challenge (M-of-N Threshold Multi-Sig)  
**Team:** Revotoken Africa  

> **Recording the submission video?** Use the current desk walkthrough:  
> **[DEMO_SCRIPT.md](./DEMO_SCRIPT.md)** (roles: Exporter → Lender → Settlement lock/settle → Auditor → BitSafe → Metrics).  
> Sections below retain framing and checklists; button names in the old scene table may be stale.

---

## 1. Executive Framing for Judges

> **What it is:**  
> Settle Flow is a reusable Daml package for structured settlement workflows on Canton, starting with a concrete 3-party Delivery-versus-Payment (DvP) pattern. It packages the repeated workflow logic around settlement (pre-atomic authorization, propose/accept coordination, disclosed contract handling, expiry/cancel paths, and reusable settlement completion) so builders do not have to rebuild it from scratch for each new use case.

> **What it is NOT:**  
> - Not a general Canton execution layer  
> - Not a standalone monolithic app  
> - Not an observability tool  
> - Not a privacy layer replacement  
> - Not a consumer wallet product  

> **Why Canton:**  
> Canton natively supports sub-transaction privacy between parties, multi-party workflows, institutional counterparties, and atomic settlement without custom zero-knowledge circuits.

---

## 2. 3-Minute Video Pitch & Demo Script

| Segment | Timing | Visual Action (Screen) | Spoken Audio Voiceover Script |
| :--- | :---: | :--- | :--- |
| **Opening** | 0:00 – 0:25 | Landing page (`/`), displaying the architecture diagram and the composability gap between isolated CIP-0056 tokens. | *"Settle Flow is a reusable Daml package for structured settlement workflows on Canton. The problem is that builders keep rewriting the same workflow plumbing for every new use case. We start with a 3-party DvP pattern to show how that logic can be reused instead of rebuilt."* |
| **Step 1 — Setup** | 0:25 – 0:45 | `/demo`: CBTC / USDCx / **cETH** legs; **Why builders adopt this** (~99 vs ~192 LOC). | *"Alice posts CBTC collateral, Bob posts USDCx cash, Oracle posts cETH as the sponsor leg. Builders adopt this layer instead of hand-rolling ~2× the Daml for every deal."* |
| **Step 2 — Propose + Accept** | 0:45 – 1:00 | Click **Run allocation matching demo**. Show agreement + commit IDs. | *"Propose and accept form the agreement — multi-party co-sign that teams normally rewrite per app."* |
| **Step 3 — Allocate + mismatch** | 1:00 – 1:45 | Watch Allocate CBTC match, then wrong USDCx amount **rejected** with verbatim reason; correct pledges → all-ready. | *"Here’s the headline: each allocation is matched to trade terms. A wrong amount is rejected — the deal stays not ready — then correct allocations unlock settle."* |
| **Step 4 — Settle + money shot** | 1:45 – 2:20 | Receipt commit → `/observer` with `visibleTokens: []`. | *"Settlement is one atomic transaction. The regulator gets a SettlementReceipt while their ACS shows visibleTokens empty — ledger privacy, not a UI filter."* |
| **Step 5 — BitSafe** | 2:20 – 2:45 | `/governance` refuse → settle at 2-of-3. | *"For governed facilities, BitSafe M-of-N blocks execute below threshold, then settles at two of three."* |
| **Close** | 2:45 – 2:55 | `/metrics` or adopt panel. | *"Same package under the next workflow — adopt this instead of writing it. Thank you."* |

---

## 3. Test Checklist for the Team (covered by automated tests)

### Core Flow Tests
- [x] **Workflow Creation:** Workflow proposals are generated successfully with unique SHA-256 deal digests.
- [x] **Proposal Generation:** `WorkflowProposal` accurately specifies multi-party legs, expiration dates, and stakeholder scoping.
- [x] **Accept / Confirm Step:** `AcceptanceTracker` collects co-signatures and gates agreement finalization until all required counterparties accept.
- [x] **End-to-End Settlement:** Atomic settlement executes all legs simultaneously inside one Daml choice (`WorkflowAgreement.Settle`).
- [x] **Final State Recording:** `SettlementReceipt` is emitted and permanently recorded on-ledger with immutable timestamps and leg summaries.

### Failure-Path Tests
- [x] **Timeout / Expiry Handling:** `ExpireProposal` choice and `demoStore.expire()` resolve stalled or timed-out proposals cleanly.
- [x] **Proposer Cancellation:** `CancelProposal` choice and `demoStore.cancel()` allow clean withdrawal before settlement.
- [x] **Counterparty Rejection:** `RejectProposal` choice and `demoStore.reject()` handle margin/terms rejection without partial state.
- [x] **Partial Completion Safety:** Proposals with partial acceptances reject premature settlement without leaking data or corrupting state.
- [x] **Atomic Revert:** Forced leg failure (`testAtomicRevert`) cleanly rolls back all legs, leaving counterparties with their original assets.

### Reuse Tests
- [x] **Multi-Run DvP Execution:** The exact same Daml package executes multiple sequential 3-party DvP workflows with zero state leakage.
- [x] **Configuration Independence:** Changing assets (e.g., CBTC/USDCx to COFFEE/USDCx or CASHEW/cETH) requires zero modifications to the core workflow package.
- [x] **Extensible Topology:** Supports 2-leg, 3-leg, and $N$-leg structured compositions through the universal `LegSpec` array.

### Demo Readiness Tests
- [x] **Timing:** Pitch demo runs in under 3 minutes (benchmark: 1-click execution in <700ms).
- [x] **Non-Builder Clarity:** Specimen cards with pastel role colorways make Canton party boundaries intuitive to non-technical judges.
- [x] **Clear Failure Explanations:** Visual error badges highlight atomicity and threshold rejection rules (`R-ATOM-2`, `R-GOV-1`).
- [x] **Obvious Reuse Story:** Clear separation between the reusable protocol engine and the African trade-finance reference specimen.

---

## 4. Production & Recording Guide

```bash
# Terminal 1: Live Commodity Oracle (:4002)
node mocks/oracle/server.mjs

# Terminal 2: API Gateway (:4000)
cd backend && npm run dev

# Terminal 3: Web App (:3000)
cd frontend && npm run dev
```

- **Resolution:** 1920x1080 (1080p Full HD) at 100% zoom.
- **Max Video Duration:** 02:55 (strictly below the 3:00 HackCanton cutoff).
- **Target Export:** MP4 (H.264/AAC, 30fps).
