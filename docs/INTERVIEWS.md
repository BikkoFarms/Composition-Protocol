# Builder interview guide (Metrics / Validation)

HackCanton scores Metrics on evidence from user research. Capture verbatim quotes.

## Target: 3–5 Canton builders (DEX / lending / AppsFactory)

### Ask

1. Do you currently hand-build multi-leg atomic settlement + per-leg privacy?
2. Would you call a shared composition primitive if it shipped as open-source Daml + Ledger API?
3. What topologies matter first? (repo, bond+CDS, fund subscription, trade finance)
4. What’s the deal-breaker: privacy model, fee UX, asset coverage (USDCx/CBTC/cETH), or ops?
5. Would you pay a small protocol fee per settled composition?

### Log template

```
Date:
Interviewee / team:
Role:
Verbatim quote:
Would adopt? Y/N/Maybe
Topology priority:
Blockers:
```

## Target: 1–2 trade-finance operators (or AfDB / Afreximbank docs)

### Ask

1. How long does working-capital against confirmed POs take today?
2. What deal terms must stay private from competitors?
3. Would atomic collateral + cash + attestation reduce funding delay?

### Evidence folder

Store notes in `docs/interviews/` (gitignored if sensitive) and summarize weekly in `docs/JOURNAL.md`.
