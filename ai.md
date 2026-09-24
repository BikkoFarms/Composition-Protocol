# Composition Protocol — AI Agent Engineering Guide & Operating Rules

## 1. Operating Identity & Core Mandate
You are an autonomous engineering agent operating on **Composition Protocol**, an institutional-grade, multi-asset atomic settlement primitive built on Canton for HackCanton Season 3.

- **Primary Track:** Track 1 (RWA & Business Workflows)
- **Secondary Track / Challenge:** BitSafe Decentralization Challenge
- **Core Directive:** Maintain 100% adherence to Daml sub-transaction privacy boundaries and atomicity guarantees. Never compromise protocol integrity for UI convenience.

---

## 2. Invariant Checklist (Must Be Preserved Across All Changes)

Before proposing, generating, or committing any code, verify all five core protocol invariants:

- [x] **`R-ATOM-1` (Single Transaction Settlement):** All leg transfers in a composition deal MUST execute within a single atomic Daml transaction choice (`CompositionAgreement.Settle` or `SettleWithRegulator`).
- [x] **`R-ATOM-2` (Zero Half-States):** If any leg fails (due to insufficient balance, spent contract, or invalid controller), the entire transaction MUST abort and revert. Counterparties retain their original assets.
- [x] **`R-PRIV-1/2/3` (Observer Scoping / The Money Shot):** Per-leg visibility is strictly bounded by Canton signatories and observers. The regulator Active Contract Set (ACS) must contain the `SettlementReceipt` and **exactly 0 token contracts (`visibleTokens: []`)**. UI-layer filtering is forbidden as a privacy mechanism.
- [x] **`R-GOV-1/2` (BitSafe M-of-N Governance):** Governed deals MUST reject execution if approvals < threshold, and MUST succeed once the threshold is met.
- [x] **`R-AUTH-1` (Ledger Authorization):** All ledger commands must specify explicit `actAs` claims matching Daml signatories and choice controllers.

---

## 3. Directory Layout & Key File Anchors

| Subsystem | Primary Directory | Critical Files | Responsibilities |
|:---|:---|:---|:---|
| **Daml Contracts** | `daml/` | `daml.yaml`<br>`daml/Composition.daml`<br>`daml/ComposableAsset.daml`<br>`daml/Governance.daml`<br>`daml/Test.daml` | Protocol primitives, CIP-0056 interface, atomic choice loops, observer scoping, Daml Script tests. |
| **Backend Orchestrator** | `backend/` | `src/index.ts`<br>`src/ledger.ts`<br>`src/demoStore.ts`<br>`src/routes/compositions.ts`<br>`src/routes/audit.ts` | Canton JSON Ledger API v2 bridge, Keycloak OIDC token manager, AcceptanceTracker engine, live metrics. |
| **Frontend Web App** | `frontend/` | `app/page.tsx`<br>`app/demo/page.tsx`<br>`app/proposer/page.tsx`<br>`app/counterparty/page.tsx`<br>`app/observer/page.tsx`<br>`app/governance/page.tsx`<br>`app/metrics/page.tsx` | Next.js 15 role dashboards, real-time polling, observer zero-leak demonstration, M-of-N governance UI. |
| **Mocks & Tools** | `mocks/` & `scripts/` | `mocks/oracle/server.mjs`<br>`scripts/oidc-token.mjs` | Commodity price/grade oracle (:4002), Keycloak OIDC retrieval script. |
| **Agentic Environment** | `.ai/` | `rules.md`<br>`skills.json`<br>`skills/*.md`<br>`context.md` | Machine-readable capability registry, execution checklists, and architectural constraints. |

---

## 4. Verification Gates & Pre-Commit Protocol

Every modification or enhancement must be verified through the following test commands:

```bash
# 1. Backend Typecheck (Strict TypeScript)
cd backend && npm run typecheck

# 2. Automated Test Gates (6/6 Suites)
cd backend && npm test
# Gates:
# - testAtomicSwap (R-ATOM-1)
# - testAtomicRevert (R-ATOM-2)
# - testAuditorCannotSeeLegs (R-PRIV-1/2/3)
# - R-GOV-1 below threshold rejected
# - R-GOV-1 at threshold succeeds
# - Judge Metrics calculation (throughput, avg legs, success/revert rates)

# 3. Frontend Production Build & Route Prerendering (10/10 Routes)
cd ../frontend && npm run build

# 4. Daml Script Test Suite (When Daml SDK 3.3.x is available)
cd ../daml && daml test
```

---

## 5. Coding Conventions for Agents

1. **Dual-Mode Graceful Fallback:**
   - Always maintain compatibility with both live Canton participant nodes (`LEDGER_MODE=ledger`) and the in-memory engine (`demoStore.ts`).
   - If `LEDGER_API_URL` or `LEDGER_MODE` is unset, the system must seamlessly run in offline demo mode.
2. **Error Responses:**
   - Any atomic settlement revert in Express must return `HTTP 409 Conflict` with `{ error: string, atomic: true, halfState: false }`.
3. **Decimals & Timestamps on Ledger:**
   - In Ledger API v2 payloads, format `Decimal` as a string (`"100.0"`), dates as `"YYYY-MM-DD"`, and optional fields as `value | null`.
4. **Git Hygiene:**
   - Always ensure working tree is clean and branches are synchronized with `main` before pushing.
