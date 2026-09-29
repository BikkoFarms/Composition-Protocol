# Daml SDK setup (Windows)

Composition Protocol targets **Daml SDK 3.3.x** (`daml/daml.yaml`).

## Install

SDK is already installable from the Digital Asset Windows tarball / `install.bat`
(see team notes). Ensure `%APPDATA%\daml\bin` is on `PATH`, then:

```bash
cd daml
daml version
daml build
daml test
```

## Expected Script gates

- `testAtomicSwap` / `testAtomicRevert`
- `testAuditorCannotSeeLegs` — regulator ACS: receipt yes, legs no
- `testAllocHappyPath3PartyDvp` + allocation failure paths
- **BitSafe M-of-N** (named controllers `Gov1,Gov2,Gov3`, **threshold = 2**):
  - `testGovernedBelowThreshold` — execute rejected at 1-of-3
  - `testGovernedAtThreshold` — execute settles at 2-of-3
  - `testGovernedCancelBelowThreshold` — cancel rejected at 1-of-3
  - `testGovernedCancelAtThreshold` — cancel succeeds at 2-of-3

## BitSafe LocalNet (reproducible)

```bash
# 1) Compile + Script gates (no network)
cd daml
daml build
daml test

# 2) Demo API + BitSafe UI (in-memory ACS mirroring the same rules)
cd ../backend && npm run dev          # :4000
cd ../frontend && npm run dev         # :3000
# Open http://localhost:3000/governance
# Controllers shown in UI comments / copy: Gov1, Gov2, Gov3 · threshold 2-of-3
# Refuse below threshold, then approve twice and settle for the camera beat.
```

Comments in `Governance.daml` / `TestGovernance.daml` name the controllers and threshold.

## Without SDK yet

```bash
cd backend && npm test
```

## Side-by-side pitch artifact

See [SIDE_BY_SIDE.md](./SIDE_BY_SIDE.md) — ~99 LOC with the layer vs ~192 LOC hand-rolled.

Upload the built DAR to the shared Noders participant once SDK build succeeds — see [DEVNET.md](./DEVNET.md).
