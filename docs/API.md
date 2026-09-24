# Composition Protocol — REST API Reference & Integration Guide

The Composition Protocol backend exposes a high-performance Express REST API on port `:4000` (configurable via `PORT` environment variable). The API operates in **dual-mode**:
1. **Live Ledger Mode (`mode: "ledger"`):** Dispatches commands directly to Canton JSON Ledger API v2 (`:7575`) with Keycloak OIDC token injection.
2. **Demo Mode (`mode: "demo"`):** Runs an in-memory simulation engine (`demoStore`) faithfully mimicking Canton party ACS visibility and atomicity rules.

---

## 1. System & Health

### `GET /health`
Returns system operational status, active ledger mode, and authentication configuration.

#### Response
```json
{
  "ok": true,
  "mode": "demo",
  "ledgerConfigured": false,
  "ledgerUrl": null,
  "oidcConfigured": false,
  "package": "composition-protocol"
}
```

---

## 2. Asset Management

### `GET /assets`
Lists token balances visible to a specific party.

#### Query Parameters
- `party` (optional, default `"Alice"`): One of `Operator`, `Alice`, `Bob`, `Oracle`, `Regulator`, `Gov1`, `Gov2`, `Gov3`.

#### Response
```json
{
  "tokens": [
    {
      "contractId": "tok-cbtc-1",
      "owner": "Alice",
      "issuer": "Operator",
      "instrumentId": "CBTC",
      "amount": "2.0"
    }
  ]
}
```

---

### `POST /assets/mint`
Mints an initial mock token contract implementing `ComposableAsset`.

#### Request Body
```json
{
  "owner": "Alice",
  "instrumentId": "CBTC",
  "amount": "1.0"
}
```

#### Response (`HTTP 201 Created`)
```json
{
  "contractId": "tok-1727181234567",
  "owner": "Alice",
  "issuer": "Operator",
  "instrumentId": "CBTC",
  "amount": "1.0"
}
```

---

## 3. Composition Lifecycle

### `GET /compositions`
Retrieves all active composition agreements, governed settlements, and aggregate metrics.

#### Response
```json
{
  "compositions": [...],
  "governances": [...],
  "metrics": {
    "compositionsSettled": 52,
    "compositionsReverted": 2,
    "legsSettled": 156,
    "avgLegsPerComposition": 3.0,
    "successRate": 96.3,
    "revertRate": 3.7
  }
}
```

---

### `POST /compositions/propose`
Creates a new multi-leg proposal.

#### Request Body
```json
{
  "proposer": "Alice",
  "counterparties": ["Bob", "Oracle"],
  "description": "African Trade Finance Deal",
  "legs": [
    {
      "legId": "collateral",
      "instrumentId": "CBTC",
      "amount": "1.0",
      "provider": "Alice",
      "receiver": "Bob",
      "assetCid": "tok-cbtc-1"
    },
    {
      "legId": "cash",
      "instrumentId": "USDCx",
      "amount": "100.0",
      "provider": "Bob",
      "receiver": "Alice",
      "assetCid": "tok-usdc-1"
    },
    {
      "legId": "attestation",
      "instrumentId": "ATTEST",
      "amount": "1.0",
      "provider": "Oracle",
      "receiver": "Bob",
      "assetCid": "tok-attest-1"
    }
  ],
  "forceFail": false,
  "requireGovernance": false
}
```

---

### `POST /compositions/:id/accept`
Records an individual counterparty's acceptance on the `AcceptanceTracker`.

#### Request Body
```json
{
  "acceptor": "Bob"
}
```

#### Response
Returns the updated composition object with `status: "partially_accepted"` or `"accepted"`.

---

### `POST /compositions/:id/settle`
Executes atomic settlement across all legs in a single Daml transaction.

#### Request Body
```json
{
  "withRegulator": true
}
```

#### Success Response (`HTTP 200 OK`)
```json
{
  "id": "comp-uuid",
  "status": "settled",
  "receiptCid": "rcpt-comp-uuid",
  "settledAt": "2026-09-24T12:00:00.000Z",
  "legSummaries": [
    { "legId": "collateral", "instrumentId": "CBTC", "status": "LegSettled" },
    { "legId": "cash", "instrumentId": "USDCx", "status": "LegSettled" },
    { "legId": "attestation", "instrumentId": "ATTEST", "status": "LegSettled" }
  ]
}
```

#### Atomic Revert Response (`HTTP 409 Conflict`)
```json
{
  "error": "atomic settle reverted: leg cash failed",
  "atomic": true,
  "halfState": false
}
```

---

## 4. Pitch Demo & Metrics Benchmarking

### `POST /compositions/demo/run-full`
One-click pitch orchestration endpoint: creates a 3-leg trade-finance proposal, accepts across all counterparties, executes atomic settlement, and returns the side-by-side money shot.

#### Request Body
```json
{
  "forceFail": false,
  "requireGovernance": false
}
```

---

### `POST /compositions/demo/load`
Generates $N$ complete end-to-end settlement transactions to supply on-chain proof for the HackCanton **Metrics criterion**.

#### Request Body
```json
{
  "count": 50
}
```

#### Response
```json
{
  "ran": 50,
  "metrics": {
    "compositionsSettled": 50,
    "compositionsReverted": 0,
    "legsSettled": 150,
    "avgLegsPerComposition": 3.0,
    "successRate": 100.0,
    "revertRate": 0.0
  }
}
```

---

## 5. Audit & Privacy Verification

### `GET /audit/money-shot`
Returns the side-by-side visibility comparison proving that while participants see assets and receipts, the regulator is cryptographically restricted from seeing token payloads.

#### Response
```json
{
  "participant": {
    "party": "Bob",
    "visibleTokens": [
      { "instrumentId": "CBTC", "amount": "1.0" },
      { "instrumentId": "ATTEST", "amount": "1.0" }
    ],
    "settlementReceipts": [...]
  },
  "observer": {
    "party": "Regulator",
    "visibleTokens": [],
    "settlementReceipts": [
      {
        "receiptCid": "rcpt-1234",
        "description": "African Trade Finance Deal",
        "legSummaries": [
          { "legId": "collateral", "status": "LegSettled" },
          { "legId": "cash", "status": "LegSettled" },
          { "legId": "attestation", "status": "LegSettled" }
        ],
        "visibleLegPayloads": []
      }
    ],
    "proof": {
      "visibleTokensEmpty": true,
      "receiptPresent": true,
      "test": "testAuditorCannotSeeLegs"
    }
  }
}
```

---

### `GET /audit/metrics`
Returns real-time performance statistics and live transaction stream.

#### Response
```json
{
  "compositionsSettled": 52,
  "compositionsReverted": 2,
  "legsSettled": 156,
  "unexpectedFailures": 0,
  "governedSettlements": 3,
  "governanceRejections": 1,
  "totalAttempted": 54,
  "avgLegsPerComposition": 3.0,
  "successRate": 96.3,
  "revertRate": 3.7,
  "recentEvents": [
    {
      "id": "comp-7182",
      "type": "settled",
      "timestamp": "2026-09-24T12:15:30.000Z",
      "legs": 3,
      "description": "African Trade Finance Deal"
    }
  ]
}
```

---

## 6. BitSafe Governance ($M$-of-$N$)

### `POST /compositions/governance/open`
Wraps an accepted composition deal into a governed multi-sig structure.

```json
{
  "compositionId": "comp-1234",
  "governors": ["Gov1", "Gov2", "Gov3"],
  "threshold": 2
}
```

### `POST /compositions/governance/:id/approve`
Records a governor signature on a pending deal.

```json
{
  "governor": "Gov1"
}
```

### `POST /compositions/governance/:id/execute`
Attempts execution of the governed settlement.
- If `approvals < threshold`: Returns `HTTP 409 Conflict` (`below threshold — governed action rejected`).
- If `approvals >= threshold`: Returns `HTTP 200 OK` and executes atomic settlement.

### `POST /compositions/governance/:id/veto`
Allows an authorized committee governor to abort an open deal prior to execution.
```json
{
  "governor": "Gov1",
  "reason": "Collateral valuation anomaly"
}
```

---

## 7. Institutional Risk Controls & Cancellation

### `POST /compositions/:id/cancel`
Allows the deal proposer to cleanly withdraw an un-settled deal.
```json
{
  "caller": "Alice"
}
```

### `GET /compositions/circuit-breaker/state`
Returns the active state of the emergency circuit breaker:
```json
{
  "isHalted": false,
  "haltReason": null,
  "haltedBy": null,
  "updatedAt": "2026-09-24T12:00:00.000Z"
}
```

### `POST /compositions/circuit-breaker/toggle`
Triggers or resets an institutional emergency circuit breaker halt:
```json
{
  "caller": "Operator",
  "reason": "Oracle inspection outage"
}
```
