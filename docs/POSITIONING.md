# How Settle Flow Differs from Existing Options on Canton

HackCanton Season 3 edition. Claims below are checked against public CIP-0056 / Splice Token Standard docs, Daml Finance settlement docs, and OpenZeppelin Canton settlement pages (as of review). Re-verify before Grand Final Q&A if standards move.

## Positioning

Settle Flow does **not** compete with the token standard or with asset registries. It builds on **CIP-0056 allocations** and owns the **trade-level coordination** that the standard leaves open for apps to hand-write.

Atomic multi-leg settlement is already a Canton / CIP-0056 / Daml Finance capability. Settle Flow’s product claim is: **one reusable trade object that collects parties, matches allocations, tracks readiness, gates execute/cancel, and cleans up failure** — so builders stop rewriting that layer per app.

## Comparison

| | **Daml Finance Batch / Instruction** | **CIP-0056 alone** | **Settle Flow** |
|---|---|---|---|
| **What it does** | Atomic multi-party settlement over Daml Finance holdings | Per-leg allocation requests; allocations with an executor; execute / withdraw / cancel | Coordinates the **whole trade** on top of CIP-0056-shaped assets |
| **Asset model** | Daml Finance holdings and instruments | Token standard interfaces (`Allocation`, `AllocationRequest`, …) | CIP-0056-shaped assets today (`ComposableAsset` / `MockToken`); Daml Finance legs via adapters later |
| **Gap** | Non–Daml Finance assets need reshaping; not what many wallets/registries integrate with | **No trade-level logic** — apps must observe allocations, decide readiness, and submit the settle tx | Needs CIP-0056-compliant assets or wrappers; atomicity itself is not the differentiator |

### Other settlement work (complementary stance)

Other teams are building settlement engines for Canton. For example, OpenZeppelin documents an experimental CIP-112-oriented settlement engine for atomic multi-leg DvP ([OpenZeppelin Canton Settlement](https://docs.openzeppelin.com/canton/settlement)). Treat engines as **leg executors**; Settle Flow **coordinates parties and readiness** and can sit above an engine via an adapter. Do not claim exclusivity over atomic DvP.

**Verified sources**

- [CIP-0056](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md) — DvP workflows: allocate → when all allocations present, settlement app submits one tx that executes transfers.
- [Splice Allocation API](https://docs.sync.global/app_dev/api/splice-api-token-allocation-v1/Splice-Api-Token-AllocationV1.html) — `Allocation_ExecuteTransfer` / `Allocation_Withdraw` / cancel; settlement fields include `executor`, `allocateBefore`, `settleBefore`.
- [Daml Finance Settlement](https://docs.daml.com/daml-finance/concepts/settlement.html) — `Instruction` + `Batch` for atomic settle of allocated/approved steps.
- CIP-0112 extends the token standard (V2); CIP-0056 remains the widely deployed baseline — keep Settle Flow aligned with CIP-0056 allocations first.

## What CIP-0056 Leaves Open (Settle Flow’s Scope)

CIP-0056 defines **how a leg is reserved and executed**. It does not ship a reusable package for:

1. **One trade object** that requests allocations from every party  
2. **Verification** that each allocation matches agreed terms (parties, amounts, instrument, reference, deadlines)  
3. **Readiness tracking** across all legs  
4. **Rules for who may execute or cancel** (e.g. BitSafe M-of-N)  
5. **Cleanup on failure** (partial alloc, expiry, withdrawn leg, unauthorized executor)

Every app hand-writes these today. That is Settle Flow’s scope.

## Why Builders Would Adopt It

Builders are not switching away from CIP-0056 or their registries. They keep those assets and **replace hand-written coordination**. “Adopt this instead of writing it” is a lower bar than displacing a library.

See the measured comparison: [SIDE_BY_SIDE.md](./SIDE_BY_SIDE.md) (~99 LOC with the layer vs ~192 LOC hand-rolled).

## Where Settle Flow Has to Prove It (demo + repo)

| Claim | Evidence in this repo |
|---|---|
| **Allocation matching** | `matchAllocationToLeg` in [`Composition.daml`](../daml/daml/Composition.daml) — parties, amount, instrument, reference, deadline, assetCid + live view |
| **Failure paths** | Daml Script: `testAllocPartialAllocation`, `testAllocExpiryBeforeAccept`, `testAllocWithdrawnLeg`, `testAllocUnauthorizedExecutor` |
| **Happy 3-party DvP** | `testAllocHappyPath3PartyDvp` + UI `/demo` |
| **Developer effort** | [SIDE_BY_SIDE.md](./SIDE_BY_SIDE.md), `examples/with-layer/` vs `examples/hand-rolled/` |
| **Permissioning** | BitSafe `GovernedSettlement` — Gov1/Gov2/Gov3, threshold 2-of-3; `/governance` |
| **Per-party audit** | `testAuditorCannotSeeLegs` + `/observer` money shot (`visibleTokens: []`) |

## Main Risk

If the token standard’s own examples, or another settlement effort, ship a similar **coordination** template, the gap narrows. Keep Settle Flow easy to align with CIP-0056 allocations and use an **adapter interface** so it stays useful on top of other engines (Daml Finance Batch, CIP-112 settle, etc.).

## Grand Final Q&A — short honest answer

> **“What already exists?”**  
> CIP-0056 (and Daml Finance Batch/Instruction) already give **atomic multi-leg settlement** and **per-leg allocations** with execute/withdraw/cancel. What apps still rebuild is the **trade coordination layer**: one deal object, allocation matching, readiness, execute/cancel policy, and failure cleanup. Settle Flow is that layer — not a new token standard, and not a claim that Canton lacked atomicity.

## Next Steps (team)

- [ ] Spot-check OpenZeppelin / CIP-112 specs repo again before finals (complementary wording only).  
- [x] Demo path: wrong-amount rejection live on `/demo` (default **Run allocation matching demo**).  
- [x] Builder LOC proof on `/demo` (**Why builders adopt this** — ~99 vs ~192).  
- [ ] Submissions close **2026-10-09** — keep this page linked from README / JUDGING.
