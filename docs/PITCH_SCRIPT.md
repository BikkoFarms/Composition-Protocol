# Composition Protocol — HackCanton Season 3 Video Pitch Script

**Duration:** Exactly 3 minutes (180 seconds)  
**Track:** Track 1: Real-World Assets (RWA) & Business Workflows  
**Challenge:** BitSafe Decentralization Challenge (M-of-N Threshold Multi-Sig)  
**Team:** Revotoken Africa  

---

## Pitch Video Timeline Breakdown

| Time Window | Segment | Visual / Screen Action | Voiceover Audio Script |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:35** | **The Problem** | Landing Page (`/`), highlighting the architecture diagram and the composability gap between isolated CIP-0056 tokens. | *"Canton Network is the premier institutional ledger for privacy-sensitive finance. CIP-0056 solved single-asset tokenization, but in the real world, institutional finance is never single-asset. Whether executing a collateralized loan, an interest rate swap, or cross-border trade finance, counterparties require multi-leg atomic swaps with custom escrow contracts. Today, builders spend weeks hand-rolling custom escrow contracts, introducing smart contract custody risks and leaking confidential trading positions across observer nodes."* |
| **0:35 – 1:15** | **The Solution & 1-Click Pitch Demo** | Switch to `/demo`. Click **"Run full happy path"**. Live settlement transaction settles in real time. | *"Enter Composition Protocol: the universal, open-source composition primitive for the Canton Network. In one single Daml choice, Composition Protocol settles arbitrary multi-asset legs atomically—all-or-nothing—with zero intermediate custody. Watch our 1-click pitch demo: Alice, a West African cocoa exporter, locks 5 CBTC in collateral; Bob, an institutional lender, injects 35,000 USDCx; while our off-chain commodity oracle generates an HMAC-signed warehouse quality certificate. In a single ledger transaction, all three legs settle simultaneously. Click 'Run atomic revert', and if a single leg fails, the entire deal unwinds instantly with zero partial state (`R-ATOM-2`)."* |
| **1:15 – 2:00** | **The "Money Shot": Canton Sub-Transaction Privacy** | Switch to `/observer`. Show the side-by-side Participant vs Regulator ACS comparison. Highlight `visibleTokens: []`. | *"Now for the architectural 'money shot' that makes Canton unique. On Ethereum or Solana, every transaction leaks token IDs, balances, and counterparties to the world. On Composition Protocol, we leverage Canton's sub-transaction privacy (`R-PRIV-1/2/3`). On the left, Bob sees his 3 token contracts on his local node. On the right, look at the regulator's Active Contract Set. The regulator receives an immutable `SettlementReceipt` with timestamp, deal hash, and compliance confirmation, but their Active Contract Set provably displays `visibleTokens: []`. Canton's sequencer never projects private token contract data to observer nodes. Complete compliance with zero competitive leakage."* |
| **2:00 – 2:35** | **BitSafe Decentralization Challenge** | Switch to `/governance`. Click **"Run 1-Click R-GOV-1 & R-GOV-2 Test Flow"**. Observe 1/2 signature rejection, then 2/2 signature approval. | *"To address institutional risk, we built our BitSafe Decentralization Challenge entry. High-value trade finance deals cannot depend on a single admin key. Using our `GovernedSettlement` Daml contract, we enforce an M-of-N threshold committee. At 1 of 2 signatures, `R-GOV-1` automatically rejects execution with a 409 conflict. When the second independent risk officer co-signs, `R-GOV-2` unlocks atomic settlement. Furthermore, any named governor can invoke an `EmergencyVeto`, and the protocol can be instantly paused via the `ProtocolCircuitBreaker`."* |
| **2:35 – 3:00** | **Validation, Metrics & Conclusion** | Switch to `/metrics`. Show 50 settlements benchmarked with 100% success rate and zero reverts. Show Mission Control `/admin`. | *"We validated demand through in-depth builder interviews across Canton DEXs, RWA credit funds, and African trade desks. Our test harness executes 50 live settlements in under 700 milliseconds with 100% success. With 11/11 automated test gates passing, complete Keycloak OIDC integration, and a dedicated Mission Control console, Composition Protocol is ready to unlock structured finance across the Canton Network. Thank you."* |

---

## Production & Recording Checklist for Team

1. **Local Setup Before Recording:**
   ```bash
   # Terminal 1: Oracle
   node mocks/oracle/server.mjs
   # Terminal 2: Backend API Gateway
   cd backend && npm run dev
   # Terminal 3: Frontend Web App
   cd frontend && npm run dev
   ```
2. **Browser Window Sizing:**
   - Set resolution to **1920x1080 (1080p Full HD)** or **1440p**.
   - Zoom level at **100%** or **90%** so all specimen cards fit comfortably.
3. **Key Visual Callouts to Emphasize with Mouse/Pointer:**
   - **At 0:55:** Hover over the green `Status: Settled` badge on `/demo`.
   - **At 1:35:** Circle the `visibleTokens: []` JSON block on `/observer`—explain that this is an actual Canton ACS query at the ledger end offset, not a CSS display trick!
   - **At 2:15:** Highlight the 2-of-3 threshold signature tracker on `/governance`.
   - **At 2:40:** Point to the 100% Success Rate and 0% Revert Rate on `/metrics`.
4. **Export Format:**
   - MP4 video file (H.264 video, AAC audio, 30fps or 60fps).
   - Maximum video duration: **02:58** (leaving a safe 2-second buffer below the 3:00 hard cutoff).
