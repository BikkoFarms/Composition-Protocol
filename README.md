# SettleFlow

**Trade-level settlement coordination on Canton** — Propose → Accept → Allocate → Settle for multi-party DvP, with mock tokens modelled on CIP-56.  
Demonstrated through a 3-party African commodity trade-finance specimen (CBTC / USDCx / cETH).

[![HackCanton Season 3](https://img.shields.io/badge/HackCanton-Season%203-blue.svg)](https://hackcanton.devpost.com/)
[![Track](https://img.shields.io/badge/Track-Track%201%20(RWA%20%26%20Business%20Workflows)-emerald.svg)](#track-details)
[![Challenge](https://img.shields.io/badge/Secondary-BitSafe%20Decentralization%20Challenge-purple.svg)](#bitsafe-decentralization-challenge)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> 🚀 **Live Production Deployments on Render**:
> - **Web Application**: [https://settleflow-frontend.onrender.com](https://settleflow-frontend.onrender.com)
> - **API Gateway**: [https://settleflow-backend-zcp7.onrender.com](https://settleflow-backend-zcp7.onrender.com) (`/health`, `/compositions`, `/audit/money-shot`)
> - **Commodity Oracle**: [https://settleflow-oracle.onrender.com](https://settleflow-oracle.onrender.com) (`/health`, `/price?symbol=COCOA`, `/attest`)

> ℹ️ **Hosted Demo Environment Status**:
> The live deployment on Render runs in a high-fidelity **in-memory simulation engine** (`/health` returns `{"mode":"demo","ledgerConfigured":false}`) to provide evaluators with instant, zero-latency testing without reliance on external DevNet sequencer uptime. Full live Canton JSON Ledger API v2 participant connectivity is built-in (`backend/src/ledger.ts`, `backend/src/ledgerWorkflow.ts`) and activates when `LEDGER_API_URL` and `LEDGER_API_TOKEN` are configured.

> **"Adopt this instead of writing it."** CIP-56 standardizes per-leg token allocations; SettleFlow standardizes the trade. The trade-finance desk is the demo that gives it a face.

**How we differ from CIP-0056 / Daml Finance / other engines:** [docs/POSITIONING.md](docs/POSITIONING.md)

---

## 1. Project Overview & Track Details

While the **CIP-56** specification standardizes digital asset allocations (execute / withdraw / cancel), applications still hand-write the **trade orchestration layer**: agreement proposals, counterparty acceptance gating, allocation matching, permissioned execution, and failure cleanup.

**SettleFlow** provides this reusable settlement coordination package: multi-party accept gating, field-level allocation matching, BitSafe M-of-N execute/cancel with unforgeable governor signatures, and ledger-enforced selective disclosure (`SettlementReceipt` for auditors; leg amounts stay off their ACS).

### Hackathon Tracks
- **Primary Track — Track 1 (RWA & Business Workflows):** Multi-asset atomic settlement primitive solving DvP, trade-finance collateralization, and multi-party asset orchestration without trusted central escrow.
- **Secondary Challenge — BitSafe Decentralization Challenge:** M-of-N governed multi-sig settlement control (`GovernedSettlement`) with unforgeable governor signatures (`GovernorApproval`) ensuring transactions require threshold consensus prior to atomic execution.
- **Team:** Revotoken Africa.

### Reference Use Case: African Commodity Trade Finance (3 Legs)
```
             ┌─────────────────────────┐
             │       SettleFlow        │
             └───────────┬─────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
   Leg 1               Leg 2               Leg 3
[Collateral]          [Cash]            [Sponsor]
    CBTC               USDCx              cETH
Exporter (Alice)   Lender (Bob)      Quality Oracle
      ↓                   ↓                   ↓
 Lender (Bob)     Exporter (Alice)      Lender (Bob)
```

| Leg | Type | Instrument | From → To | Business Purpose |
|:---|:---|:---|:---|:---|
| **Leg 1** | Collateral | `CBTC` (2.0) | Exporter (Alice) → Lender (Bob) | Tokenized warehouse collateral locked |
| **Leg 2** | Cash | `USDCx` (10000.0) | Lender (Bob) → Exporter (Alice) | Trade finance liquidity disbursed |
| **Leg 3** | Sponsor | `cETH` (1.5) | Quality Oracle → Lender (Bob) | onRails sponsor asset (multi-asset proof) |

---

## 2. Architecture Layers

The protocol is structured across four decoupled architectural tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: Frontend UI (Next.js 15 App Router / TypeScript)                   │
│  /demo (Allocate + match)    /proposer (Alice)      /counterparty (Bob)│
│  /observer (Regulator ACS)   /governance (BitSafe)  /metrics (Evidence)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / JSON REST
┌───────────────────────────────────▼────────────────────────────────────┐
│ L2: Backend & Orchestration Engine (Node.js / Express :4000)          │
│  • Proposal & Acceptance Tracker state machine                         │
│  • In-memory DemoStore (faithful ACS & visibility simulation)          │
│  • Metrics collection (throughput, revert count, leg metrics)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Canton JSON Ledger API v2 (:7575)
┌───────────────────────────────────▼────────────────────────────────────┐
│ L3: Canton Ledger & Daml Smart Contracts (Daml 3.x / Target 2.1)       │
│  • ComposableAsset (Interface) & MockToken (modelled on CIP-56)        │
│  • WorkflowProposal, AcceptanceTracker, WorkflowAgreement              │
│  • SettlementReceipt (zero-leak blinded observer proof)                │
│  • GovernedSettlement & GovernorApproval (BitSafe M-of-N multi-sig)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Event / HTTP
┌───────────────────────────────────▼────────────────────────────────────┐
│ L4: Mocks & External Services                                          │
│  • Price & Quality Grade Oracle (:4002)                                │
│  • Simulated Fiat & Off-Chain Settlement Hooks                         │
└────────────────────────────────────────────────────────────────────────┘
```

### Layer Details
1. **L1 UI (Client Layer):** Role-tailored dashboards built with Next.js 15, React, and CSS variables. Emphasizes live state polling, clear stakeholder role separation, and the regulator "money shot".
2. **L2 Backend (Acceptance Tracker & Bridge):** Express server on port `:4000`. Tracks counterparties' acceptances before settlement eligibility. Includes `ledger.ts` (JSON Ledger API v2 client) with graceful fallback to `demoStore.ts` for rapid local testing without a Canton node.
3. **L3 Canton Ledger (Smart Contracts):** Daml 3.x contracts deployed on Canton (`composition` package). Executes atomic multi-leg transfers in a single transaction choice (`Settle`) and emits observer-partitioned receipts.
4. **L4 Mocks (Ecosystem Services):** Node.js Oracle service on port `:4002` publishing live price and inspection grade feeds; mock token contracts (`MockToken`) modelled on the CIP-56 token specification.

---

## 3. Core Technical Guarantees

### 3.1 Absolute Atomicity (`R-ATOM-1`, `R-ATOM-2`)
- **Single Daml Transaction (`R-ATOM-1`):** All settlement legs are executed in a single atomic Daml choice (`WorkflowAgreement.Settle` or `SettleGoverned`).
- **Zero Half-Settled States (`R-ATOM-2`):** Daml transaction semantics ensure that if any transfer choice within the loop fails (e.g., token already spent, insufficient authorization, contract mismatch), the **entire transaction reverts**. No party loses their assets, and intermediate states cannot persist on ledger.

### 3.2 Selective Disclosure & Audit Privacy (`R-PRIV-1`, `R-PRIV-2`, `R-PRIV-3`)
- **Composite Agreement Visibility:** Counterparties co-sign `WorkflowAgreement` to confirm trade terms, participant roles, and agreed leg parameters.
- **The Regulator "Money Shot" (`R-PRIV-3`):** Auditors and regulators are granted observer rights solely to `SettlementReceipt` (verifying settlement occurred, timestamps, and aggregate leg IDs). Their Active Contract Set (ACS) contains **zero** leg payloads or token contracts:
  $$\text{Regulator ACS} \implies \texttt{visibleTokens: []}, \quad \texttt{settlementReceipts: [receipt]}$$
- **Per-Leg Holding Privacy:** Actual token holdings (`ComposableAsset` / `MockToken`) transfer strictly between the designated `provider` and `receiver` on each leg via Canton sub-transaction privacy—third parties (such as the Oracle on the cash leg) do not become signatories or observers of those holding contracts.

### 3.3 BitSafe M-of-N Decentralized Governance (`R-GOV-1`, `R-GOV-2`)
- **Unforgeable Governor Signatures:** Each governor co-signs via a dedicated `GovernorApproval` contract (`signatory governor`), preventing the operator from fabricating approvals.
- **Enforced Governance Gate:** When `governanceRequired = True`, `WorkflowAgreement` locks direct settlement choices (`assertMsg "governed settlement required"`), enforcing that settlement MUST execute through `GovernedSettlement.ExecuteGoverned` once threshold $M$ is met.
- **Circuit Breaker & Emergency Veto:** `ProtocolCircuitBreaker` pauses settlement when `isHalted = True`. An authorized governor calling `EmergencyVeto` immediately archives the underlying `WorkflowAgreement`, permanently aborting the deal and releasing locked allocations.

### 3.4 Multi-Party Entity Co-Signing & Independent Confirmation Workflow
In SettleFlow, **every participant is an autonomous cryptographic identity** on Canton:
- **Exporter (`Alice`):** Originates the deal terms and proposes the composition.
- **Lender (`Bob`):** Institutional credit provider who must independently review terms and collateral before committing cash.
- **Oracle (`Oracle`):** Price & inspection authority who validates commodity grade and valuation.

#### Two Operational Modalities:
1. **Production Multi-Desk Flow (Real Multi-Party Governance):**
   - **Step 1 (Propose):** Alice proposes on the Exporter Desk (`/proposer`). The deal enters `proposed` status.
   - **Step 2 (Lender Review & Co-Sign):** Bob inspects the trade on the Lender Desk (`/counterparty`) and clicks **`[Accept as Bob]`** (or **`[Reject Trade]`**). Status updates to `partially_accepted`.
   - **Step 3 (Oracle Attestation):** Oracle inspects the trade on `/counterparty` (or an automated bot daemon) and clicks **`[Accept as Oracle]`**.
   - **Step 4 (Agreement Formation):** Only once **all** counterparties have signed does the Daml ledger form the legally binding `CompositionAgreement`.
   - **Step 5 (Lock & Settle):** Parties lock their pledged assets (`LegAllocation`), and atomic settlement (`Settle`) is unlocked.
2. **Accelerated Evaluation Shortcut (`/demo`):**
   - The Settlement Desk (`/demo`) contains an automated evaluation runner (`/compositions/demo/open-desk`) built specifically for evaluators and hackathon judges to experience atomic allocation matching without having to switch browser sessions across 3 roles.

### 3.5 Canton Web3 Wallet & Identity Management (CIP-103)
Aligned with the official [Canton Developer Hub](https://dev-hub.canton.foundation/) and [Canton Documentation](https://docs.canton.network/):
- **CIP-0103 dApp API Integration:** Connect using official browser extensions including **PartyLayer (CIP-103)**, **PixelPlex Console Wallet** (`@console-wallet/dapp-sdk`), **5North Loop Wallet**, **Splice Wallet Kernel**, or **WalletConnect**.
- **Canton Multihash Party IDs:** Full support for deterministic Canton party identifiers (`hint::1220<sha256>`) with 1-click clipboard copy.
- **Participant User Management:** Real-time party switcher in the top navigation allowing instant switching between Alice, Bob, Oracle, Operator, and Regulator.
- **Live Node Telemetry:** Live round-trip millisecond latency ping against Canton Ledger API v2 participant nodes (`/v2/state/ledger-end`) and Keycloak OIDC direct-grant status.
- **On-Chain KYC Credentials:** Integrated with **Five North ID SDK (5N ID)** for verifiable institutional compliance.

---

## 4. Repository Structure

```
Composition-Protocol/         # repo root (SettleFlow)
├── .ai/                      # AI agent rules, capabilities, skill definitions
├── daml/                     # Daml 3.x contracts + Script gates
│   └── daml/
│       ├── ComposableAsset.daml
│       ├── MockToken.daml
│       ├── Composition.daml  # Propose → Accept → Allocate → Settle
│       ├── Governance.daml   # BitSafe M-of-N
│       ├── Test.daml
│       └── TestGovernance.daml
├── backend/                  # Express API & Ledger API v2 bridge (:4000)
│   └── src/
│       ├── demoStore.ts      # Demo ACS + allocation matching
│       ├── demoStore.test.ts # Node test gates (22)
│       ├── ledger.ts
│       └── routes/
├── frontend/                 # Next.js 15 App Router (:3000)
│   ├── app/demo/             # Allocation matching centerpiece
│   ├── components/BrandMark.tsx  # SettleFlow SF mark
│   └── lib/api.ts
├── examples/                 # Builder LOC proof
│   ├── with-layer/ThreePartyDvp.daml      # ~99 LOC
│   └── hand-rolled/HandRolledDvp.daml     # ~192 LOC
├── mocks/oracle/             # Price / grade oracle (:4002)
├── scripts/oidc-token.mjs    # Keycloak OIDC for HackCanton DevNet
├── docs/
│   ├── POSITIONING.md
│   ├── SIDE_BY_SIDE.md
│   ├── JUDGING.md
│   ├── DEVNET.md
│   ├── Composition_Protocol_PRD.pdf
│   └── Composition_Protocol_SRD.pdf
├── TESTING.md
├── DEPLOYMENT.md
├── PRODUCT REQUIREMENTS DOCUMENT-PRD - Updated.docx
├── Technical Specification- H.docx
└── docker-compose.yml
```

---

## 5. Quick Start & Local Setup

### Mode A: Demo Mode (No Canton Node Required)
In Demo Mode, the backend runs an in-memory simulation engine that faithfully enforces multi-party state transitions, acceptance gates, atomic reverts, and Canton party visibility.

```bash
# 1. Start the Backend API (Port 4000)
cd backend
npm install
npm run dev

# 2. Start the Frontend UI (Port 3000)
cd ../frontend
npm install
npm run dev

# 3. (Optional) Start the Mock Oracle (Port 4002)
node mocks/oracle/server.mjs
```

Open your browser to:
- **Settlement desk:** [http://localhost:3000/demo](http://localhost:3000/demo) — **Run allocation matching demo** (Propose → Allocate → mismatch reject → Settle; LOC adopt panel)
- **Observer Money Shot:** [http://localhost:3000/observer](http://localhost:3000/observer) (Verify `visibleTokens: []` + receipt)
- **BitSafe Governance:** [http://localhost:3000/governance](http://localhost:3000/governance) (2-of-3 threshold demo)
- **Load Metrics:** [http://localhost:3000/metrics](http://localhost:3000/metrics) (Settle 50+ batch deals)

---

### Mode B: Docker Compose
Run the entire stack in containerized environment:

```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Oracle: `http://localhost:4002`

---

### Mode C: Live Canton Ledger (DevNet / LocalNet)

To connect the backend to an active Canton participant node via the JSON Ledger API v2:

1. **Configure Environment Variables:**
   ```bash
   export LEDGER_API_URL=https://ledger-api-json.participant.hackcanton-01.devnet.naas.noders.services
   export LEDGER_API_TOKEN=<oidc-access-token>
   export DAML_PACKAGE_ID=<uploaded-dar-package-id>
   export DAML_PACKAGE_NAME=composition
   ```

2. **Acquire OIDC Token from Keycloak:**
   ```bash
   OIDC_CLIENT_ID=... OIDC_USERNAME=... OIDC_PASSWORD=... node scripts/oidc-token.mjs
   ```

3. **Build & Upload DAR Package:**
   ```bash
   cd daml
   daml build
   # Upload .daml/dist/composition-0.1.0.dar via participant admin API
   ```

4. **Start Backend:**
   ```bash
   cd backend && npm run dev
   # Verify that GET http://localhost:4000/health returns "mode": "ledger"
   ```

---

---

## 6. Verification & Automated Test Gates

All core protocol guarantees are verified across multi-layer test gates (see [**TESTING.md**](TESTING.md) for complete guide):

### 1. Backend Automated Gate Suite
Verifies atomicity, revert integrity, regulator privacy, BitSafe M-of-N threshold logic, failure paths, reusability, and SRS §12 gates:
```bash
npm test
```
**Automated Gate Results (33/33 Passing):**
- `testAtomicSwap` — 2+ legs settle all-or-nothing (`R-ATOM-1`) **[Pass]**
- `testAtomicRevert` — failed leg leaves no half-state (`R-ATOM-2`) **[Pass]**
- `testAuditorCannotSeeLegs` — regulator `visibleTokens: []` + receipt present (`R-PRIV-1/2/3`) **[Pass]**
- `allocation mismatch rejected — no half-state` — wrong amount rejected verbatim **[Pass]**
- `allocate → settle — commits + ready_to_settle gate` — per-leg match before settle **[Pass]**
- `R-GOV-1 below threshold rejected` — execution blocked with < M approvals **[Pass]**
- `R-GOV-1 at threshold succeeds` — execution unlocked with == M approvals (`R-GOV-2`) **[Pass]**
- `Judge Metrics` — throughput, average legs/deal, and success/revert rates **[Pass]**
- `Proposer Cancellation` — allows clean withdrawal before settlement **[Pass]**
- `Emergency Circuit Breaker` — blocks settlement during halt and resumes **[Pass]**
- `Institutional Emergency Veto` — named governor can abort open governed deal **[Pass]**
- `Cryptographic Deal Hash & Valuation` — enforces sha256 digest and LTV ratio **[Pass]**
- `Operator Treasury Direct Minting` — issues new composable assets to party ACS **[Pass]**
- `Failure Path: Expiry` — resolves stalled or timed-out proposals cleanly **[Pass]**
- `Failure Path: Rejection` — counterparty rejection cleanly resolves without half-state **[Pass]**
- `Failure Path: Partial completion` — maintains valid state without premature execution **[Pass]**
- `Disclosed Contract Handling` — attaches and preserves explicit contract disclosures **[Pass]**
- `Reuse Verification` — executes multiple distinct 3-party DvP configurations without modifying package logic **[Pass]**
- `SRS §12: testWorkflowProposal` — confirms proposal creation and workflow initialization **[Pass]**
- `SRS §12: testWorkflowAcceptance` — confirms acceptance and state progression **[Pass]**
- `SRS §12: testWorkflowExpiryOrCancel` — confirms stalled workflows resolve cleanly **[Pass]**
- `SRS §12: testWorkflowSettlement` — confirms settlement completes end to end **[Pass]**
- `FR-8: demo assets issuance` — tokenized asset & payment tokens as CIP-56 holdings **[Pass]**
- `FR-9: audit trail per party` — per-party scoped history without privacy leakage **[Pass]**
- `FR-10: failure path — wrong executor rejected` — blocks unauthorized caller from settlement **[Pass]**
- `FR-10: failure path — cancelled trade releases allocations` — clean lock release **[Pass]**
- `FR-10 & FR-11: partial allocation blocks settlement` — gates readiness until all legs matched **[Pass]**
- `FR-10: failure path — withdrawn leg blocks settlement` — unallocating blocks settle until restored **[Pass]**
- `FR-12: allocate-by and settle-by deadlines` — time-bounded expiration prevents stranded trades **[Pass]**
- `FR-13: permissioning matrix` — stage-based execute and cancel access control **[Pass]**
- `FR-14: privacy rules` — strict third-party isolation vs counterparties **[Pass]**
- `FR-16: settlement backend adapter` — pluggable settlement engine abstraction **[Pass]**
- `FR-19: policy hooks` — sanctions eligibility, transaction limits, and fees **[Pass]**

### 2. Daml Script Test Suite
Verifies on-ledger sub-transaction semantics, Canton stakeholder visibility, and SRS §12 gates (requires [Daml SDK 3.3.x](https://docs.daml.com/)):
```bash
cd daml
daml build
daml test
```
**Tests Covered (9 Passing Scripts):**
- `Test.daml:testAtomicSwap`
- `Test.daml:testAtomicRevert`
- `Test.daml:testAuditorCannotSeeLegs`
- `Test.daml:testWorkflowProposal` (SRS §12)
- `Test.daml:testWorkflowAcceptance` (SRS §12)
- `Test.daml:testWorkflowExpiryOrCancel` (SRS §12)
- `Test.daml:testWorkflowSettlement` (SRS §12)
- `TestGovernance.daml:testGovernedBelowThreshold`
- `TestGovernance.daml:testGovernedAtThreshold`

### 3. Live E2E Integration Suite (13 Tests)
Runs full network socket tests across backend (:4000) and oracle (:4002):
```bash
npm run test:e2e
```

### 4. PRD §7 8-Step Demo Scenario Runner
Executes the authoritative 8-step PRD walkthrough in a single automated runbook:
```bash
npm run demo:scenario
```

---

## 7. Implementation Status & Next Milestones

| Component | Status | Verification / Artifact |
| :--- | :--- | :--- |
| **Daml Smart Contracts** | Complete | `ComposableAsset`, `Composition`, `Governance`, `Workflow`, `DisclosedContract` |
| **Daml Script Test Gates** | Complete (9/9) | `Test.daml` and `TestGovernance.daml` covering R-ATOM, R-PRIV, R-GOV, and SRS §12 |
| **Backend Express API** | Complete | REST routes for assets, compositions, audit, governance, circuit-breaker, admin |
| **JSON Ledger API v2 Client** | Complete | `ledger.ts` supporting `submit-and-wait` and ACS queries with Keycloak OIDC & Disclosed Contracts |
| **Backend Test Gates** | Passing (33/33) | `npm test` — covers atomicity, privacy, BitSafe M-of-N, failure paths, deadlines, withdrawn legs, and PRD FR-1..19 |
| **Live E2E Socket Tests** | Passing (13/13) | `npm run test:e2e` verifying live integration across ports :4000 and :4002 |
| **PRD Demo Scenario Runner** | Passing (8/8) | `npm run demo:scenario` verifying PRD §7 8-step sequence |
| **Frontend Next.js Views** | Complete (12/12 routes) | 8 interactive role views (`/demo`, `/proposer`, `/counterparty`, `/observer`, `/governance`, `/metrics`, `/readiness`, `/admin`) |
| **Commodity Oracle Service** | Complete | `mocks/oracle/server.mjs` serving live spot prices & HMAC attestations on `:4002` |
| **Documentation & Runbooks** | Complete | `DEPLOYMENT.md`, `TESTING.md`, PRD, SRS, Architecture, API, Risk assessment |

---

## 8. Documentation Hub & Deep Dives

- [**CONTRIBUTIONS_REPORT.md**](CONTRIBUTIONS_REPORT.md) — Comprehensive engineering contribution report detailing code, architectures, test suites, and commits delivered by John Okyere (`mhiskall282`) and Demiladepy.
- [**SettleFlow_PRD.docx**](SettleFlow_PRD.docx) / [**docs/SettleFlow_PRD.md**](docs/SettleFlow_PRD.md) — Authoritative SettleFlow PRD (October 2026 Edition for HackCanton S3).
- [**SettleFlow_Differentiation.docx**](SettleFlow_Differentiation.docx) / [**docs/SettleFlow_Differentiation.md**](docs/SettleFlow_Differentiation.md) — Authoritative differentiation matrix against CIP-0056, Daml Finance, and CIP-112.
- [**DEPLOYMENT.md**](DEPLOYMENT.md) — Step-by-step deployment guide covering LocalNet, Docker Compose, Canton Sandbox, and Shared HackCanton DevNet.
- [**TESTING.md**](TESTING.md) — Testing manual: Daml scripts, 27 backend gates, E2E, browser allocation walkthrough.
- [**docs/POSITIONING.md**](docs/POSITIONING.md) — How Settleflow differs from CIP-0056 / Daml Finance / engines.
- [**docs/SIDE_BY_SIDE.md**](docs/SIDE_BY_SIDE.md) — ~99 vs ~192 LOC builder proof (`examples/`).
- [**PRODUCT REQUIREMENTS DOCUMENT-PRD - Updated.docx**](PRODUCT%20REQUIREMENTS%20DOCUMENT-PRD%20-%20Updated.docx) — Historical PRD archive.
- [**Technical Specification- H.docx**](Technical%20Specification-%20H.docx) — Updated SRS.
- [**docs/Composition_Protocol_PRD.pdf**](docs/Composition_Protocol_PRD.pdf) — PRD PDF archive.
- [**docs/Composition_Protocol_SRD.pdf**](docs/Composition_Protocol_SRD.pdf) — SRD PDF archive.
- [**CONTRIBUTING.md**](CONTRIBUTING.md) — Contributor onboarding, engineering rules, status matrix, and pre-commit checklists.
- [**docs/RISK_ASSESSMENT.md**](docs/RISK_ASSESSMENT.md) — Rigorous protocol and operational risk assessment, invariant guarantees, and threat mitigations.
- [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) — Technical blueprint, Mermaid lifecycle diagrams, sub-transaction privacy models, and failure modes.
- [**docs/PROTOCOL.md**](docs/PROTOCOL.md) — Protocol Interface (PI) specification, Daml smart contract interfaces, wire payloads, and Canton sub-transaction privacy.
- [**docs/API.md**](docs/API.md) — Complete REST API reference, request/response schemas, query parameters, and cURL examples.
- [**docs/JUDGING.md**](docs/JUDGING.md) — HackCanton Season 3 evaluation guide, Track 1 & BitSafe challenge alignment, and 3-minute quick walkthrough.
- [**docs/IMPLEMENTATION_PLAN.md**](docs/IMPLEMENTATION_PLAN.md) — Full FR/SR requirements audit matrix cross-referencing PRD/SRD specifications.
- [**docs/DEVNET.md**](docs/DEVNET.md) — Shared HackCanton DevNet node connection, Keycloak OIDC token flow, and DAR deployment.
- [**docs/DAML_SETUP.md**](docs/DAML_SETUP.md) — Daml SDK 3.3.x environment setup, compilation, and script testing.
- [**docs/INTERVIEWS.md**](docs/INTERVIEWS.md) — Builder interviews, qualitative evidence, and validation metrics for Criterion 3.
- [**docs/PITCH_SCRIPT.md**](docs/PITCH_SCRIPT.md) — 3-minute video pitch presentation script, voiceover dialogue, and recording checklist.
- [**context.md**](context.md) — System background, African commodity trade finance topology, and ecosystem token registry.
- [**ai.md**](ai.md) — AI agent engineering directives, operating rules, and invariant checklists.
- [**docs/JOURNAL.md**](docs/JOURNAL.md) — Daily AI-guided hackathon engineering log (judging artifact).

---

## 9. Pre-existing Code Disclosure

Per HackCanton Season 3 official guidelines: Any contracts or code created prior to **September 18, 2026** must be disclosed.  
**This repository's initial delivery-phase commit represents the first public codebase**—no prior private DAR or codebase is claimed as in-window work. The evaluation window runs from **September 18 to October 9, 2026**.

---

## 10. License

Distributed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.

