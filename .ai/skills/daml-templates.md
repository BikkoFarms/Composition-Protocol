# Skill: Build & Refine Daml Templates

## Objective
Author, modify, and maintain Daml 3.x smart contracts in `daml/daml/` that adhere to CIP-0056 and enforce atomic, multi-asset settlement and per-leg stakeholder visibility.

## Key Files
- `daml/daml.yaml` — SDK version (`3.3.0`), target (`2.1`), and dependencies (`daml-prim`, `daml-stdlib`, `daml-script`).
- `daml/daml/ComposableAsset.daml` — Standard asset interface definition with `Transfer` choice.
- `daml/daml/MockToken.daml` — Reference implementation of `ComposableAsset`.
- `daml/daml/Composition.daml` — Core templates: `CompositionProposal`, `AcceptanceTracker`, `CompositionAgreement`, `SettlementReceipt`.
- `daml/daml/Governance.daml` — `GovernedSettlement` and `GovernanceFactory` for M-of-N threshold control.

## Guiding Principles & Invariants
1. **Interface Polymorphism:** Any asset implementing `ComposableAsset` can participate as a leg in a composition deal.
2. **Acceptance Gating:** The proposal cannot transition into an agreement until `AcceptanceTracker` holds approvals from every required party in `counterparties`.
3. **Atomic Choice Execution:** Within `CompositionAgreement.Settle`, execute all leg transfers in a single transaction loop:
   ```daml
   forA_ legs $ \leg -> do
     exercise leg.assetCid Transfer with newOwner = leg.receiver
   ```
4. **Observer Minimization:** The `SettlementReceipt` must declare `regulators` as observers, but MUST NOT include leg contract IDs (`assetCid`) or specific token balance contracts.

## Build Commands
```bash
cd daml
daml build
daml test
```
