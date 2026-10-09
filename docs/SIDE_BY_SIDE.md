# Side-by-side: Settle Flow vs hand-rolled 3-party DvP

**Pitch proof:** adopt the Composition layer instead of writing coordination by hand.

| | **With Settle Flow** | **Hand-rolled equivalent** |
|---|---|---|
| Artifact | [`examples/with-layer/ThreePartyDvp.daml`](../examples/with-layer/ThreePartyDvp.daml) | [`examples/hand-rolled/HandRolledDvp.daml`](../examples/hand-rolled/HandRolledDvp.daml) |
| Lines (approx.) | **~99** (orchestration only) | **~192** (proposal, accept gate, allocations, atomic settle, privacy receipt, expire/cancel) |
| Atomic multi-leg | `Settle` / `SettleWithRegulator` | Manual `forA_` + custom abort path |
| Acceptance gate | `AcceptanceTracker` | Hand-built required/accepted sets |
| Allocation match | `matchAllocationToLeg` (parties, amount, instrument, reference, deadline, asset) | Re-implemented field checks |
| Regulator privacy | `SettlementReceipt` observers; legs off-receipt | Easy to leak `assetCid`/amounts onto receipt |
| BitSafe M-of-N | `GovernedSettlement` 2-of-3 | Extra templates + thrash risk |
| Reuse | Same DAR for next deal / next asset class | Copy-paste per workflow |

**Complexity delta:** ~**2×** the Daml surface for a single 3-party DvP hand-rolled — before BitSafe governance or DevNet ops — and every new workflow pays that cost again. The layer collapses it into Propose → Accept → Allocate → Settle.

## What the layer owns (you don't rewrite)

1. Multi-party accept gating until the full counterparty set is in  
2. Field-level allocation matching (reject whole tx on any mismatch)  
3. Single-transaction all-or-none settlement  
4. Blinded receipt for regulators (`visibleTokens: []`)  
5. Optional M-of-N execute/cancel (`Gov1,Gov2,Gov3` · threshold `2`)

## Reproduce LocalNet

```bash
cd daml && daml test   # includes testAllocHappyPath3PartyDvp + testAuditorCannotSeeLegs + testGoverned*
cd backend && npm test # demoStore mirrors the same claims
```

**On the judge path:** http://localhost:3000/demo — panel **Why builders adopt this** (~99 vs ~192).  
UI money shot: http://localhost:3000/observer  
BitSafe beat: http://localhost:3000/governance
