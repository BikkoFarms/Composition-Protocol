# Composition Protocol

**Atomic, private, multi-asset settlement primitive built on Canton.**  
Demonstrated through cross-border African commodity trade finance.

[![HackCanton Season 3](https://img.shields.io/badge/HackCanton-Season%203-blue.svg)](https://hackcanton.devpost.com/)
[![Track](https://img.shields.io/badge/Track-Track%201%20(RWA%20%26%20Business%20Workflows)-emerald.svg)](#track-details)
[![Challenge](https://img.shields.io/badge/Secondary-BitSafe%20Decentralization%20Challenge-purple.svg)](#bitsafe-decentralization-challenge)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

> **"The protocol is the product. The trade-finance flow is the demo that gives it a face."**

---

## 1. Project Overview & Track Details

While **CIP-0056** made digital assets portable across Canton domains, real-world finance requires them to be **combinable**. Standard business transactions do not happen in isolation: a delivery-versus-payment (DvP) trade or collateralized trade-finance facility requires collateral transfer, cash disbursal, and third-party attestations to settle concurrently.

**Composition Protocol** delivers a reusable Daml primitive that bundles multiple distinct asset transfers into a single transaction that **either fully settles or completely aborts (all-or-nothing)**, while enforcing **per-leg privacy** directly through Canton’s cryptographic stakeholder model (`signatory` and `observer`).

### Hackathon Tracks
- **Primary Track — Track 1 (RWA & Business Workflows):** Multi-asset atomic settlement primitive solving DvP, trade-finance collateralization, and multi-party asset orchestration without trusted central escrow.
- **Secondary Challenge — BitSafe Decentralization Challenge:** M-of-N governed multi-sig settlement control (`GovernedSettlement`) ensuring transactions require threshold consensus prior to atomic execution.
- **Team:** Revotoken Africa.

### Reference Use Case: African Commodity Trade Finance (3 Legs)
```
             ┌─────────────────────────┐
             │       Composition       │
             │        Protocol         │
             └───────────┬─────────────┘
                         │
     ┌───────────────────┼───────────────────┐
     │                   │                   │
   Leg 1               Leg 2               Leg 3
[Collateral]          [Cash]          [Attestation]
    CBTC               USDCx           Grade Report
Exporter (Alice)   Lender (Bob)      Quality Oracle
      ↓                   ↓                   ↓
 Lender (Bob)     Exporter (Alice)      Lender (Bob)
```

| Leg | Type | Instrument | From → To | Business Purpose |
|:---|:---|:---|:---|:---|
| **Leg 1** | Collateral | `CBTC` (1.0) | Exporter (Alice) → Lender (Bob) | Tokenized warehouse collateral locked |
| **Leg 2** | Cash | `USDCx` (100.0) | Lender (Bob) → Exporter (Alice) | Trade finance liquidity disbursed |
| **Leg 3** | Attestation | `ATTEST` (1.0) | Quality Oracle → Lender (Bob) | Commodity grade & inspection verified |

---

## 2. Architecture Layers

The protocol is structured across four decoupled architectural tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1: Frontend UI (Next.js 15 App Router / TypeScript)                   │
│  /demo (One-click pitch)     /proposer (Alice)      /counterparty (Bob)│
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
│  • ComposableAsset (CIP-0056 Interface) & MockToken                    │
│  • CompositionProposal, AcceptanceTracker, CompositionAgreement        │
│  • SettlementReceipt (scopable observer proof)                         │
│  • GovernedSettlement & GovernanceFactory (BitSafe M-of-N)             │
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
3. **L3 Canton Ledger (Smart Contracts):** Daml 3.x contracts deployed on Canton. Executes atomic multi-leg transfers in a single transaction choice (`Settle`) and emits observer-partitioned receipts.
4. **L4 Mocks (Ecosystem Services):** Node.js Oracle service on port `:4002` publishing live price and inspection grade feeds; mock token contracts implementing `ComposableAsset`.

---

## 3. Core Technical Guarantees

### 3.1 Absolute Atomicity (`R-ATOM-1`, `R-ATOM-2`)
- **Single Daml Transaction (`R-ATOM-1`):** All settlement legs are executed in a single atomic Daml choice (`CompositionAgreement.Settle`).
- **Zero Half-Settled States (`R-ATOM-2`):** Daml transaction semantics ensure that if any transfer choice within the loop fails (e.g., token already spent, insufficient authorization, contract mismatch), the **entire transaction reverts**. No party loses their assets, and intermediate states cannot persist on ledger.

### 3.2 Per-Leg Stakeholder Privacy (`R-PRIV-1`, `R-PRIV-2`, `R-PRIV-3`)
- **Cryptographic Exclusion (`R-PRIV-1` / `R-PRIV-2`):** Privacy is enforced at the sub-transaction protocol level using Canton's `signatory` and `observer` rules—**never via UI filtering**.
- **The "Money Shot" (`R-PRIV-3`):** Auditors and regulators are granted observer rights solely to `SettlementReceipt` (verifying settlement occurred, timestamps, and aggregate leg IDs). Their Active Contract Set (ACS) contains **zero** leg payloads or token contracts:
  $$\text{Regulator ACS} \implies \texttt{visibleTokens: []}, \quad \texttt{settlementReceipts: [receipt]}$$

### 3.3 BitSafe M-of-N Decentralized Governance (`R-GOV-1`, `R-GOV-2`)
- **Below-Threshold Rejection (`R-GOV-1`):** Settlement wrapped in `GovernedSettlement` strictly fails if attempted with fewer than $M$ approvals.
- **Threshold Execution (`R-GOV-2`):** Once $M$ of $N$ designated governors approve, execution completes atomically and dispatches `SettlementReceipt`.

---

## 4. Repository Structure

```
Composition-Protocol/
├── .ai/                    # AI agent rules, capabilities, and skill definitions
│   ├── rules.md            # System constraints (atomicity, privacy, stack rules)
│   ├── skills.json         # Agent capability registry
│   └── skills/             # Modular skill guides (daml, ledger, express, tests)
├── daml/                   # Daml 3.x contracts and Daml Script test gates
│   ├── daml.yaml           # SDK 3.3.0 configuration (target 2.1)
│   └── daml/
│       ├── ComposableAsset.daml  # CIP-0056 asset interface
│       ├── MockToken.daml        # Interface-implementing token template
│       ├── Composition.daml      # Proposal, Tracker, Agreement, Receipt
│       ├── Governance.daml       # BitSafe M-of-N GovernedSettlement
│       ├── Test.daml             # Acceptance gates: atomic swap, revert, privacy
│       └── TestGovernance.daml   # BitSafe M-of-N acceptance tests
├── backend/                # Express API & Ledger API v2 bridge (:4000)
│   ├── src/
│   │   ├── index.ts        # Server entry & route registration
│   │   ├── ledger.ts       # Canton JSON Ledger API v2 client
│   │   ├── demoStore.ts    # High-fidelity ACS simulation engine
│   │   ├── demoStore.test.ts # Node.js test gates (5 suites)
│   │   └── routes/         # Assets, Compositions, Governance, Audit routes
│   └── tsconfig.json
├── frontend/               # Next.js 15 App Router web app (:3000)
│   ├── app/
│   │   ├── page.tsx        # Landing page & architecture summary
│   │   ├── demo/           # One-click pitch demo with step-by-step walkthrough
│   │   ├── proposer/       # Exporter (Alice) proposal creation & asset view
│   │   ├── counterparty/   # Lender (Bob) & Oracle acceptance portal
│   │   ├── observer/       # Regulator / Auditor ACS zero-leak verification
│   │   ├── governance/     # BitSafe 2-of-3 multi-sig approval dashboard
│   │   ├── metrics/        # Real-time protocol performance & load metrics
│   │   └── admin/          # Principal Architect & Operator Mission Control
│   └── lib/api.ts          # API client wrapper
├── mocks/
│   └── oracle/             # Live Commodity Oracle & Cryptographic Attestation service (:4002)
├── scripts/
│   └── oidc-token.mjs      # Keycloak OIDC token generator for shared DevNet
├── docs/                   # PRD, SRD, DevNet, and hackathon journal
│   ├── Composition_Protocol_PRD.pdf
│   ├── Composition_Protocol_SRD.pdf
│   ├── DEVNET.md
│   └── JOURNAL.md
└── docker-compose.yml      # Multi-container orchestration (API, UI, Oracle)
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
- **Pitch Demo:** [http://localhost:3000/demo](http://localhost:3000/demo) (Run the full happy path or trigger an atomic revert)
- **Observer Money Shot:** [http://localhost:3000/observer](http://localhost:3000/observer) (Verify `visibleTokens: []`)
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

All core protocol guarantees are verified across two distinct test layers:

### 1. Node.js Backend Gate Suite
Verifies atomicity, revert integrity, regulator privacy, BitSafe M-of-N threshold logic, and judge metrics:
```bash
cd backend
npm test
```
**Automated Gate Results (6/6 Passing):**
- `testAtomicSwap` — 2+ legs settle all-or-nothing (`R-ATOM-1`) **[Pass]**
- `testAtomicRevert` — failed leg leaves no half-state (`R-ATOM-2`) **[Pass]**
- `testAuditorCannotSeeLegs` — regulator `visibleTokens: []` + receipt present (`R-PRIV-1/2/3`) **[Pass]**
- `R-GOV-1 below threshold rejected` — execution blocked with < M approvals **[Pass]**
- `R-GOV-1 at threshold succeeds` — execution unlocked with == M approvals (`R-GOV-2`) **[Pass]**
- `Judge Metrics` — throughput, average legs/deal, and success/revert rates **[Pass]**

### 2. Daml Script Test Suite
Verifies on-ledger sub-transaction semantics and Canton stakeholder visibility (requires [Daml SDK 3.3.x](https://docs.daml.com/)):
```bash
cd daml
daml build
daml test
```
**Tests Covered:**
- `Test.daml:testAtomicSwap`
- `Test.daml:testAtomicRevert`
- `Test.daml:testAuditorCannotSeeLegs`
- `TestGovernance.daml:testGovernedBelowThreshold`
- `TestGovernance.daml:testGovernedAtThreshold`

---

## 7. Implementation Status & Next Milestones

| Component | Status | Verification / Artifact |
|:---|:---:|:---|
| **Daml Smart Contracts** | Complete | `ComposableAsset`, `Composition`, `Governance`, `MockToken` |
| **Daml Script Test Gates** | Complete | `Test.daml` and `TestGovernance.daml` covering R-ATOM, R-PRIV, R-GOV |
| **Backend Express API** | Complete | REST routes for assets, compositions, audit, governance, and admin |
| **JSON Ledger API v2 Client** | Complete | `ledger.ts` supporting `submit-and-wait` and ACS queries with Keycloak OIDC |
| **Backend Test Gates** | Passing (11/11) | `npm test` passing in `backend/` in 551ms |
| **Frontend Next.js Views** | Complete | 7 interactive role views (`/demo`, `/proposer`, `/counterparty`, `/observer`, `/governance`, `/metrics`, `/admin`) |
| **Commodity Oracle Service** | Complete | `mocks/oracle/server.mjs` serving live spot prices & HMAC attestations on `:4002` |
| **Agentic Environment** | Operational | `.ai/rules.md`, `.ai/skills.json`, `.ai/context.md`, `.ai/ai.md`, and modular skills |
| **Documentation Hub** | Complete | Architecture, API reference, Judging guide, Implementation plan, Context, AI guide |

---

## 8. Documentation Hub & Deep Dives

- [**CONTRIBUTING.md**](CONTRIBUTING.md) — Contributor onboarding, engineering rules, status matrix, and pre-commit checklists.
- [**docs/RISK_ASSESSMENT.md**](docs/RISK_ASSESSMENT.md) — Rigorous protocol and operational risk assessment, invariant guarantees, and threat mitigations.
- [**docs/ARCHITECTURE.md**](docs/ARCHITECTURE.md) — Technical blueprint, Mermaid lifecycle diagrams, sub-transaction privacy models, and failure modes.
- [**docs/PROTOCOL.md**](docs/PROTOCOL.md) — Protocol Interface (PI) specification, Daml smart contract interfaces, wire payloads, and Canton sub-transaction privacy.
- [**docs/API.md**](docs/API.md) — Complete REST API reference, request/response schemas, query parameters, and cURL examples.
- [**docs/JUDGING.md**](docs/JUDGING.md) — HackCanton Season 3 evaluation guide, Track 1 & BitSafe challenge alignment, and 3-minute quick walkthrough.
- [**docs/IMPLEMENTATION_PLAN.md**](docs/IMPLEMENTATION_PLAN.md) — Full FR/SR requirements audit matrix cross-referencing PRD/SRD specifications.
- [**context.md**](context.md) — System background, African commodity trade finance topology, and ecosystem token registry.
- [**ai.md**](ai.md) — AI agent engineering directives, operating rules, and invariant checklists.
- [**docs/DEVNET.md**](docs/DEVNET.md) — Shared HackCanton DevNet node connection, Keycloak OIDC token flow, and DAR deployment.
- [**docs/JOURNAL.md**](docs/JOURNAL.md) — Daily AI-guided hackathon engineering log (judging artifact).

---

## 9. Pre-existing Code Disclosure

Per HackCanton Season 3 official guidelines: Any contracts or code created prior to **September 18, 2026** must be disclosed.  
**This repository's initial delivery-phase commit represents the first public codebase**—no prior private DAR or codebase is claimed as in-window work. The evaluation window runs from **September 18 to October 9, 2026**.

---

## 10. License

Distributed under the Apache 2.0 License. See [LICENSE](LICENSE) for details.

