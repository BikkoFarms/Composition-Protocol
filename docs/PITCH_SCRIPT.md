# Canton Composition Layer — HackCanton Season 3 Video Pitch Script & Judge Guide

**Duration:** Under 3 minutes (Target: 175 seconds)  
**Track:** Track 1: Real-World Assets (RWA) & Business Workflows  
**Challenge:** BitSafe Decentralization Challenge (M-of-N Threshold Multi-Sig)  
**Team:** Revotoken Africa  

---

## 1. Executive Framing for Judges

> **What it is:**  
> Canton Composition Layer is a reusable, wallet-compatible Daml package for structured settlement workflows on Canton, starting with a concrete 3-party Delivery-versus-Payment (DvP) pattern. It packages the repeated workflow logic around settlement (pre-atomic authorization, propose/accept coordination, disclosed contract handling, expiry/cancel paths, and reusable settlement completion) so builders do not have to rebuild it from scratch for each new use case.

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
| **Opening** | 0:00 – 0:25 | Landing page (`/`), displaying the architecture diagram and the composability gap between isolated CIP-0056 tokens. | *"Canton Composition Layer is a reusable Daml package for structured settlement workflows on Canton. The problem is that builders keep rewriting the same workflow plumbing for every new use case. We start with a 3-party DvP pattern to show how that logic can be reused instead of rebuilt."* |
| **Step 1 — Setup** | 0:25 – 0:50 | Switch to `/demo`. Highlight the configured parties (Party A: Exporter Alice, Party B: Lender Bob, Party C: Oracle). | *"I’ll start by showing the workflow configuration and the parties involved. This is the reusable package loaded with a structured settlement pattern: Alice brings tokenized commodity collateral, Bob provides USDCx working capital, and our Oracle supplies a cryptographically verified quality grade."* |
| **Step 2 — Create Workflow** | 0:50 – 1:15 | Click **"Initiate Proposal"** or observe the active proposal specimen card. Show proposal details. | *"Now the workflow is initiated. You can see the proposal created and the relevant parties notified, with only the intended parties seeing the right parts of the flow via Canton's native stakeholder model."* |
| **Step 3 — Accept / Coordinate** | 1:15 – 1:40 | Show counterparty acceptances checking off in real time on the `AcceptanceTracker`. | *"Next, the counterparties accept and the workflow advances. This is the repeated multi-party co-signing logic that teams normally rebuild by hand across weeks of bespoke Daml engineering."* |
| **Step 4 — Disclosure & Path Handling** | 1:40 – 2:15 | Switch to `/observer`. Show the **"Money Shot"**: Bob sees token contracts; Regulator ACS provably shows `visibleTokens: []`. Show Cancel/Expiry button. | *"Here’s the disclosed contract handling and the expiry/cancel path. If market conditions change, the proposer can cancel cleanly, and timed-out deals resolve via the expiry path without leaving half-settled states. Notice the architectural money shot: the regulator's node receives the immutable `SettlementReceipt`, while its Active Contract Set provably displays `visibleTokens: []`—ledger-enforced confidentiality without leaking trade secrets."* |
| **Step 5 — Settlement** | 2:15 – 2:40 | Switch to `/governance`. Show the BitSafe 2-of-3 threshold execution and instant atomic commit. | *"Now the settlement completes on-ledger in a single atomic transaction. For high-value facilities, our BitSafe M-of-N governance committee ensures dual-control authorization before commit. All transfer legs settle simultaneously, or revert with zero partial state."* |
| **Close** | 2:40 – 2:55 | Switch to `/metrics`. Show 50 settlements benchmarked with 100% success rate, sub-second latency, and live audit stream. | *"The key point is not just that this one workflow works — it’s that the same package can be reused as the plumbing underneath future structured Canton workflows. Thank you."* |

---

## 3. Test Checklist for the Team (100% Verified)

### Core Flow Tests
- [x] **Workflow Creation:** Workflow proposals are generated successfully with unique SHA-256 deal digests.
- [x] **Proposal Generation:** `CompositionProposal` accurately specifies multi-party legs, expiration dates, and stakeholder scoping.
- [x] **Accept / Confirm Step:** `AcceptanceTracker` collects co-signatures and gates agreement finalization until all required counterparties accept.
- [x] **End-to-End Settlement:** Atomic settlement executes all legs simultaneously inside one Daml choice (`CompositionAgreement.Settle`).
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
