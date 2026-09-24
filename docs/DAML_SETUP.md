# Daml SDK setup (Windows)

Composition Protocol targets **Daml SDK 3.3.x** (`daml/daml.yaml`).

## Install

```powershell
# Official installer
Invoke-WebRequest https://get.daml.com -OutFile get-daml.sh
# Or use the Windows docs:
# https://docs.daml.com/getting-started/installation.html
```

After install, ensure `%USERPROFILE%\.daml\bin` is on `PATH`, then:

```bash
cd daml
daml version
daml build
daml test
```

Expected Script gates:

- `testAtomicSwap`
- `testAtomicRevert`
- `testAuditorCannotSeeLegs`
- `testGovernedBelowThreshold`
- `testGovernedAtThreshold`

## Without SDK yet

Node gates cover the same claims against the demo store:

```bash
cd backend && npm test
```

Upload the built DAR to the shared Noders participant once SDK build succeeds — see [DEVNET.md](./DEVNET.md).
