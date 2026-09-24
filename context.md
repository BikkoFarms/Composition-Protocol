# Composition Protocol — Project Context & System Architecture

## 1. Executive Summary & Problem Space

**Composition Protocol** is an atomic, private, multi-asset settlement primitive built on Canton for **HackCanton Season 3** (Track 1: RWA & Business Workflows primary; Track 2: Financial Applications framing; BitSafe Decentralization challenge secondary).

- **Team:** Revotoken Africa
- **Core Motto:** *"The protocol is the product. The trade-finance flow is the demo that gives it a face."*

### The Core Problem
While **CIP-0056** made single assets portable across Canton domains, real institutional financial transactions require assets to be **combinable**. Real-world deals are inherently multi-leg:
- A repo is collateral + cash + a price check.
- A bond-plus-CDS is a bond leg + a protection leg + a premium leg.
- African commodity trade finance is tokenized warehouse collateral + liquidity cash disbursal + third-party grade attestation.

Prior to Composition Protocol, every protocol team on Canton had to rebuild atomic multi-leg settlement and party-visibility logic from scratch. Composition Protocol eliminates this redundancy by providing a shared, verifiable primitive.

---

## 2. Reference Topology: African Commodity Trade Finance (3 Legs)

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

| Leg | Role | Asset | Provider → Receiver | Visibility Scoping |
|:---|:---|:---|:---|:---|
| **Leg 1** | Collateral | `CBTC` (1.0) | Exporter (Alice) → Lender (Bob) | Alice, Bob, Operator |
| **Leg 2** | Liquidity Cash | `USDCx` (100.0) | Lender (Bob) → Exporter (Alice) | Bob, Alice, Operator |
| **Leg 3** | Attestation | `ATTEST` (1.0) | Quality Oracle → Lender (Bob) | Oracle, Bob, Operator |
| **Receipt**| Settlement Proof | `SettlementReceipt` | Emitted by Operator | Alice, Bob, Oracle, **Regulator** |

---

## 3. Four Architectural Layers

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
│  • Keycloak OIDC Token client with automatic expiry caching            │
│  • Metrics collection (throughput, revert count, leg metrics, audit)   │
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

---

## 4. Key Invariants & Protocol Guarantees

1. **Atomicity (`R-ATOM-1`, `R-ATOM-2`):**
   - Settlement maps `Transfer` over every leg in a single atomic Daml transaction (`CompositionAgreement.Settle`).
   - If any leg fails, the entire transaction reverts. No intermediate or half-settled state can ever exist on ledger.
2. **Per-Leg Privacy (`R-PRIV-1`, `R-PRIV-2`, `R-PRIV-3`):**
   - Per-leg visibility is enforced via Canton `signatory` and `observer` boundaries.
   - Auditors/Regulators observe `SettlementReceipt` but have `visibleTokens: []` on their Active Contract Set (ACS).
   - Zero UI filtering — privacy is enforced at the sub-transaction cryptographic level.
3. **Decentralized Governance (`R-GOV-1`, `R-GOV-2`):**
   - BitSafe challenge extension: `GovernedSettlement` enforces $M$-of-$N$ multi-sig consensus before atomic execution.
   - Execution is strictly blocked below threshold and unlocked once the threshold is satisfied.
4. **Authorization (`R-AUTH-1`):**
   - Every ledger command specifies explicit `actAs` claims matching Daml contract signatories and controllers.
5. **Deployment Flexibility (`R-DEPLOY-1`):**
   - Dual-mode architecture: Runs against live Canton JSON Ledger API v2 (`LEDGER_MODE=ledger`) or local in-memory simulation (`demoStore`) for instant offline demos.

---

## 5. Ecosystem Assets

- **USDCx:** Cash leg representing Canton-native settlement liquidity.
- **CBTC (BitSafe):** Tokenized Bitcoin collateral backing the credit facility.
- **cETH (onRails):** CIP-0056-compliant token proving multi-asset composability.
- **ATTEST:** Non-fungible commodity inspection grade certificate issued by the Oracle.
