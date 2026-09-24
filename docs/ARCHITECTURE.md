# Composition Protocol — Architectural Specification & Technical Blueprint

This document details the architectural design, security properties, transaction mechanics, and privacy boundaries of the **Composition Protocol**, an atomic, private, multi-asset settlement primitive built on Canton for HackCanton Season 3.

---

## 1. Architectural Overview & System Decomposition

Composition Protocol separates concerns into four distinct, loosely coupled layers:

```mermaid
graph TD
    subgraph L1["L1: Role-Based User Interfaces (Next.js 15 / TypeScript)"]
        UI_DEMO["/demo<br/>One-Click Pitch Walkthrough"]
        UI_PROP["/proposer<br/>Exporter Proposal Portal"]
        UI_CPTY["/counterparty<br/>Lender & Oracle Acceptance"]
        UI_OBS["/observer<br/>Regulator Zero-Leak View"]
        UI_GOV["/governance<br/>BitSafe 2-of-3 Multi-Sig"]
        UI_MET["/metrics<br/>On-Chain Throughput & Rates"]
    end

    subgraph L2["L2: Orchestration & Bridge Service (Express :4000)"]
        RT_COMP["/compositions<br/>Lifecycle State Machine"]
        RT_ASSET["/assets<br/>Token Balances & Minting"]
        RT_AUDIT["/audit<br/>ACS Views & Money-Shot Proof"]
        RT_GOV["/governance<br/>M-of-N Threshold Engine"]
        MEM_STORE["DemoStore Engine<br/>Canton ACS Simulation"]
        OIDC_MGR["Keycloak OIDC Client<br/>Token Fetch & Expiry Cache"]
    end

    subgraph L3["L3: Canton Ledger & Smart Contracts (Daml 3.x)"]
        CONTRACT_PROP["CompositionProposal<br/>Proposal & Expiry"]
        CONTRACT_TRACK["AcceptanceTracker<br/>Multi-Party Gate"]
        CONTRACT_AGREE["CompositionAgreement<br/>Atomic Settle Choice"]
        CONTRACT_RCPT["SettlementReceipt<br/>Scoped Audit Proof"]
        CONTRACT_GOV["GovernedSettlement<br/>M-of-N Consensus Gate"]
        IFACE_ASSET["ComposableAsset (Interface)<br/>CIP-0056 Transfer Choice"]
    end

    subgraph L4["L4: Ecosystem Fixtures & External Mocks"]
        MOCK_ORACLE["Price & Quality Oracle<br/>HTTP Feed on :4002"]
        MOCK_TOKEN["MockToken Template<br/>USDCx, CBTC, cETH"]
        MOCK_FIAT["Fiat Settlement Logger<br/>Off-chain Hook"]
    end

    UI_DEMO --> L2
    UI_PROP --> L2
    UI_CPTY --> L2
    UI_OBS --> L2
    UI_GOV --> L2
    UI_MET --> L2

    RT_COMP --> OIDC_MGR
    RT_COMP --> MEM_STORE
    RT_ASSET --> MEM_STORE
    RT_AUDIT --> MEM_STORE

    OIDC_MGR -.->|JSON Ledger API v2 :7575| L3
    MEM_STORE -.->|Mirrors Sub-tx Visibility| L3
    L3 --> IFACE_ASSET
    L4 --> L3
```

---

## 2. Core Protocol Lifecycle & State Machine

The composition lifecycle transitions through four strictly ordered states, ensuring all counterparties co-sign before any asset movement occurs:

```mermaid
sequenceDiagram
    autonumber
    actor Alice as Exporter (Proposer)
    actor Bob as Lender (Counterparty)
    actor Oracle as Quality Oracle (Counterparty)
    actor Regulator as Regulator (Observer)
    participant Ledger as Canton Ledger / Daml

    Note over Alice,Ledger: Phase 1: Proposal Creation
    Alice->>Ledger: create CompositionProposal (legs: CBTC, USDCx, ATTEST)
    Ledger-->>Bob: Disclose proposal via observer role
    Ledger-->>Oracle: Disclose proposal via observer role

    Note over Bob,Ledger: Phase 2: Acceptance Gating
    Bob->>Ledger: exercise proposal AcceptProposal (Bob)
    Ledger->>Ledger: create AcceptanceTracker (accepted: [Bob])
    Oracle->>Ledger: exercise proposal AcceptProposal (Oracle)
    Ledger->>Ledger: update AcceptanceTracker (accepted: [Bob, Oracle])
    
    Note over Alice,Ledger: Phase 3: Agreement Finalization
    Ledger->>Ledger: exercise FinalizeAgreement (all counterparties accepted)
    Ledger->>Ledger: create CompositionAgreement (signatory: Operator, observer: Alice, Bob, Oracle)

    Note over Alice,Ledger: Phase 4: Atomic Settlement Choice
    Alice->>Ledger: exercise agreement SettleWithRegulator(regulator)
    critical Single Daml Transaction
        Ledger->>Ledger: exercise Leg 1 Transfer (CBTC: Alice -> Bob)
        Ledger->>Ledger: exercise Leg 2 Transfer (USDCx: Bob -> Alice)
        Ledger->>Ledger: exercise Leg 3 Transfer (ATTEST: Oracle -> Bob)
        Ledger->>Ledger: create SettlementReceipt (observer: Alice, Bob, Oracle, Regulator)
    end

    Note over Regulator,Ledger: Phase 5: Zero-Leak Audit Verification
    Regulator->>Ledger: queryActive(SettlementReceipt)
    Ledger-->>Regulator: Return Receipt (status: LegSettled, timestamp)
    Regulator->>Ledger: queryActive(MockToken)
    Ledger-->>Regulator: Return visibleTokens: [] (Cryptographically Excluded!)
```

---

## 3. Cryptographic Privacy & Stakeholder Model (`R-PRIV-1/2/3`)

Traditional transparent blockchains require complex zero-knowledge (ZK) circuits to hide transaction details. On Canton, selective disclosure is enforced at the sub-transaction level via Daml’s **`signatory`** and **`observer`** access control model.

### 3.1 Stakeholder Matrix

| Contract / Payload | Signatories | Observers | Excluded Parties |
|:---|:---|:---|:---|
| **`CompositionProposal`** | Proposer, Operator | All required counterparties | Unrelated third parties, Regulators |
| **`AcceptanceTracker`** | Operator | Required counterparties | Regulators, non-participating nodes |
| **`CompositionAgreement`** | Operator | Proposer, All counterparties | Regulators, public network |
| **Leg 1: `CBTC` Token** | Operator, Exporter (Alice) | Lender (Bob) | Oracle, Regulator |
| **Leg 2: `USDCx` Token** | Operator, Lender (Bob) | Exporter (Alice) | Oracle, Regulator |
| **Leg 3: `ATTEST` Token** | Operator, Quality Oracle | Lender (Bob) | Exporter (Alice), Regulator |
| **`SettlementReceipt`** | Operator | All deal parties, **Regulator** | Non-disclosed external entities |

### 3.2 The "Money Shot" Architecture
- **Participant ACS (Bob):** Sees his inbound `CBTC` collateral, outbound `USDCx` debit, inbound `ATTEST` certificate, and the `SettlementReceipt`.
- **Observer ACS (Regulator):** Queries Canton's Active Contract Set (ACS) at the ledger end offset. Because `MockToken` instances declare only leg stakeholders, Canton's domain sequencer **never projects token contract data to the regulator's node**.
- **Audit Outcome:**
  ```text
  Regulator Active Contract Set (ACS) Query Result:
  ├── visibleTokens:        []        (0 token contracts disclosed — cryptographic exclusion)
  └── settlementReceipts:   [Receipt] (Immutable audit proof with timestamp and leg statuses)
  ```
  $$\text{Regulator ACS} \implies \{ \text{visibleTokens: []}, \; \text{settlementReceipts: [Receipt]} \}$$

---

## 4. Transaction Atomicity & Failure Modes (`R-ATOM-1/2`)

Atomicity is guaranteed by Daml’s deterministic execution engine rather than off-chain two-phase commit protocols:

```daml
choice SettleWithRegulator : ContractId SettlementReceipt
  with
    regulator : Party
  controller operator
  do
    now <- getTime
    -- R-ATOM-1: All transfers execute in this loop within one transaction.
    forA_ legs $ \leg -> do
      exercise leg.assetCid Transfer with newOwner = leg.receiver
    
    let summaries = map (\l -> LegSummary with
          legId = l.legId
          instrumentId = l.instrumentId
          status = LegSettled) legs
          
    create SettlementReceipt with
      operator
      participants = parties
      settledAt = now
      description
      legSummaries = summaries
      regulators = Set.fromList [regulator]
```

### Failure Guarantee
If Leg 2 fails (e.g., Lender Bob has insufficient `USDCx` balance or contract ID was double-spent):
1. The Daml execution engine traps the abort.
2. The transaction rolls back **100% of state changes**.
3. Alice retains her `CBTC` collateral contract; Oracle retains the `ATTEST` contract.
4. No intermediate or half-settled contract is ever committed to Canton's synchronization domain (`R-ATOM-2`).

---

## 5. BitSafe Decentralized Governance ($M$-of-$N$ Multi-Sig)

To satisfy the **BitSafe Decentralization Challenge**, high-value compositions can be wrapped inside a `GovernedSettlement` template:

```mermaid
stateDiagram-v2
    [*] --> AwaitingGovernance: Settle requested with requireGovernance=true
    AwaitingGovernance --> GovernedOpen: GovernedSettlement created (M-of-N threshold)
    GovernedOpen --> Approving: Governor approves deal
    Approving --> GovernedOpen: Approvals < Threshold (R-GOV-1: Execute rejected)
    Approving --> ThresholdMet: Approvals >= Threshold
    ThresholdMet --> Settled: ExecuteGoverned choice exercised (R-GOV-2: Atomic settle)
    Settled --> [*]: SettlementReceipt emitted
```

### Threshold Invariants
- **`R-GOV-1` (Rejection Below Threshold):**
  ```daml
  assertMsg "below threshold — governed action must not execute"
    (Set.size approvals >= threshold)
  ```
  Calling `ExecuteGoverned` when approvals $< M$ triggers an explicit transaction failure.
- **`R-GOV-2` (Execution at Threshold):**
  Once approvals $\ge M$, `ExecuteGoverned` transitions the deal directly into `CompositionAgreement.SettleWithRegulator`, maintaining single-transaction atomicity.

---

## 6. Canton JSON Ledger API v2 Integration

The backend interacts with Canton via the modern JSON Ledger API v2:

| Operation | HTTP Endpoint | Payload Structure |
|:---|:---|:---|
| **Submit Command** | `POST /v2/commands/submit-and-wait` | `{ commands: { commandId, actAs, commands: [CreateCommand \| ExerciseCommand] } }` |
| **Get Ledger Offset** | `GET /v2/state/ledger-end` | Returns latest ledger offset string |
| **Query Active Contracts** | `POST /v2/state/active-contracts` | `{ filter: { filtersByParty: { [party]: { cumulative: [TemplateFilter] } } }, activeAtOffset }` |

### Dynamic OIDC Token Handling
When `LEDGER_MODE=ledger`, the backend dynamically acquires an access token from Keycloak:
- **Token Endpoint:** `https://keycloak.naas.noders.services/realms/noders-appsfactory/protocol/openid-connect/token`
- **Grant Type:** `password`
- **Audience:** `https://hackcanton-01.devnet.naas.noders.services`
- **Token Caching:** Automatically cached in memory and renewed 30 seconds prior to expiration.
