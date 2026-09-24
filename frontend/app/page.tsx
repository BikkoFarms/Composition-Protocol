import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section style={{ textAlign: "center", padding: "3rem 1rem 4rem", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.35rem 0.95rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", marginBottom: "1.5rem" }}>
          <span className="pulse-dot" />
          <span className="mono" style={{ fontSize: "0.82rem", color: "#6ee7b7", fontWeight: 600 }}>
            HackCanton Season 3 · Track 1 Primary & BitSafe Challenge
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.4rem)", marginBottom: "1.25rem", letterSpacing: "-0.04em" }}>
          Atomic. Private.<br />Multi-Asset Settlement.
        </h1>

        <p className="lede" style={{ margin: "0 auto 2.5rem", fontSize: "1.22rem", maxWidth: "44rem", color: "var(--muted)", lineHeight: 1.6 }}>
          The native institutional primitive on Canton: bundle collateral, liquidity cash, and attestations into a single transaction that <strong style={{ color: "#fff" }}>either fully settles or cleanly aborts</strong> — each party seeing only its own leg.
        </p>

        <div className="hero-actions" style={{ justifyContent: "center" }}>
          <Link className="btn primary" href="/demo" style={{ padding: "0.85rem 1.8rem", fontSize: "1rem" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Launch Pitch Demo
          </Link>
          <Link className="btn" href="/observer" style={{ padding: "0.85rem 1.6rem", fontSize: "1rem" }}>
            Observer Money Shot (R-PRIV-3)
          </Link>
          <Link className="btn cyan" href="/governance" style={{ padding: "0.85rem 1.6rem", fontSize: "1rem" }}>
            BitSafe 2-of-3 Multi-Sig
          </Link>
        </div>
      </section>

      {/* 3-Leg Interactive Topology Showcase */}
      <section style={{ marginBottom: "3.5rem" }}>
        <div className="panel panel-glow-accent" style={{ background: "rgba(14, 25, 19, 0.8)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <span className="tag ok">Reference Deal Topology</span>
              <h2 style={{ margin: "0.4rem 0 0", fontSize: "1.4rem" }}>African Commodity Trade Finance (3 Concurrent Legs)</h2>
            </div>
            <span className="mono" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
              Executed in 1 Single Daml Tx · Zero Half-State Escrow
            </span>
          </div>

          <div className="grid grid-3" style={{ gap: "1rem", position: "relative" }}>
            <div style={{ background: "rgba(5, 12, 8, 0.7)", border: "1px solid var(--line-glass)", borderRadius: "12px", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span className="tag cyan">Leg 1: Collateral</span>
                <span className="mono" style={{ color: "#6ee7b7", fontWeight: 700 }}>2.0 CBTC</span>
              </div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "#fff" }}>Exporter (Alice) → Lender (Bob)</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                BitSafe tokenized Bitcoin warehouse receipt encumbered as borrowing base collateral.
              </p>
              <div className="mono" style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--subtle)" }}>
                Domain: canton-domain-rwa-01.eu
              </div>
            </div>

            <div style={{ background: "rgba(5, 12, 8, 0.7)", border: "1px solid var(--line-glass)", borderRadius: "12px", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span className="tag ok">Leg 2: Liquidity Cash</span>
                <span className="mono" style={{ color: "#6ee7b7", fontWeight: 700 }}>10,000 USDCx</span>
              </div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "#fff" }}>Lender (Bob) → Exporter (Alice)</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Canton-native digital cash liquidity disbursed simultaneously for working capital.
              </p>
              <div className="mono" style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--subtle)" }}>
                Domain: canton-domain-liquidity-02.us
              </div>
            </div>

            <div style={{ background: "rgba(5, 12, 8, 0.7)", border: "1px solid var(--line-glass)", borderRadius: "12px", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span className="tag warn">Leg 3: Attestation</span>
                <span className="mono" style={{ color: "#fde047", fontWeight: 700 }}>1.0 ATTEST</span>
              </div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", color: "#fff" }}>Oracle → Lender (Bob)</h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.5 }}>
                Third-party commodity inspection certificate (Grade A cocoa) validating physical asset quality.
              </p>
              <div className="mono" style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "var(--subtle)" }}>
                Domain: canton-domain-oracle-03.global
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Card Bento Grid */}
      <section style={{ marginBottom: "3.5rem" }}>
        <h2 style={{ fontSize: "1.8rem", marginBottom: "1.5rem" }}>Architectural Core Guarantees</h2>

        <div className="grid grid-2" style={{ gap: "1.5rem" }}>
          <div className="panel panel-glow-accent">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <span className="tag ok">R-ATOM-1 / R-ATOM-2</span>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff" }}>Single-Tx Atomic All-Or-Nothing</h3>
            </div>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              All transfer legs execute inside a single Daml transaction choice. If any token transfer fails (due to spent UTXO, insufficient balance, or unauthorized caller), <strong style={{ color: "#fff" }}>the entire transaction reverts atomically</strong>. Zero partial states, zero escrow freeze.
            </p>
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(0,0,0,0.4)", borderRadius: "6px" }}>
              <span className="mono" style={{ fontSize: "0.8rem", color: "#6ee7b7" }}>
                ✓ Verified by testAtomicSwap & testAtomicRevert
              </span>
            </div>
          </div>

          <div className="panel panel-glow-cyan">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <span className="tag cyan">R-PRIV-1 / 2 / 3</span>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff" }}>Sub-Transaction Privacy (Money Shot)</h3>
            </div>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              Per-leg privacy is enforced directly through Canton cryptographic stakeholders (<code className="mono">signatory</code> and <code className="mono">observer</code>) — never via superficial UI filters. Regulators verify that settlement occurred via <code className="mono">SettlementReceipt</code> while their token Active Contract Set is <strong style={{ color: "#6ee7b7" }}>strictly empty: visibleTokens: []</strong>.
            </p>
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(0,0,0,0.4)", borderRadius: "6px" }}>
              <span className="mono" style={{ fontSize: "0.8rem", color: "#67e8f9" }}>
                ✓ Verified by testAuditorCannotSeeLegs
              </span>
            </div>
          </div>

          <div className="panel">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <span className="tag warn">R-GOV-1 / R-GOV-2</span>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff" }}>BitSafe M-of-N Governance Gate</h3>
            </div>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              High-value settlements are guarded by an institutional $M$-of-$N$ threshold multi-sig committee (<code className="mono">GovernedSettlement</code>). Execution is strictly blocked below threshold and executes atomically once threshold is met. Includes an Emergency Circuit Breaker for halting compromised deals.
            </p>
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(0,0,0,0.4)", borderRadius: "6px" }}>
              <span className="mono" style={{ fontSize: "0.8rem", color: "#fde047" }}>
                ✓ Verified by testGovernedBelowThreshold & testGovernedAtThreshold
              </span>
            </div>
          </div>

          <div className="panel">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <span className="tag ok">CIP-0056 & Canton v2</span>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff" }}>Composable Asset Standard & Dual Mode</h3>
            </div>
            <p style={{ color: "var(--muted)", lineHeight: 1.6, fontSize: "0.95rem" }}>
              Any fungible or non-fungible token implementing the <code className="mono">ComposableAsset</code> interface plugs directly into atomic deals. Ships with dual-mode operational architecture: seamlessly runs on live Canton Ledger API v2 with Keycloak OIDC, or via high-fidelity in-memory local simulation.
            </p>
            <div style={{ marginTop: "1rem", padding: "0.75rem", background: "rgba(0,0,0,0.4)", borderRadius: "6px" }}>
              <span className="mono" style={{ fontSize: "0.8rem", color: "#a7f3d0" }}>
                ✓ 10/10 Verification Test Gates Passing
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Launchpad Call to Action */}
      <section style={{ textAlign: "center", padding: "3rem 1.5rem", background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "18px" }}>
        <h2 style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>Ready to Evaluate the Protocol?</h2>
        <p style={{ color: "var(--muted)", maxWidth: "34rem", margin: "0 auto 1.75rem", fontSize: "1.05rem" }}>
          Run the full 5-minute pitch demo, inspect party-scoped Active Contract Sets, and stress-test 50+ atomic settlements.
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap" }}>
          <Link className="btn primary" href="/demo">
            Start Live Pitch Demo →
          </Link>
          <Link className="btn" href="/metrics">
            View Protocol Metrics
          </Link>
        </div>
      </section>
    </div>
  );
}
