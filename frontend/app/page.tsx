import Link from "next/link";

export default function HomePage() {
  return (
    <div>
      <p className="tag">HackCanton Season 3 · Track 1</p>
      <h1>Atomic. Private. Multi-asset.</h1>
      <p className="lede">
        Composition Protocol is a reusable Daml primitive on Canton: bundle
        several asset transfers into one deal that either all settles or none
        does — each party seeing only its own leg. Demonstrated through African
        commodity trade finance.
      </p>
      <div className="hero-actions">
        <Link className="btn" href="/demo">
          Run pitch demo
        </Link>
        <Link className="btn" href="/observer">
          Observer money shot
        </Link>
        <Link className="btn" href="/governance">
          BitSafe M-of-N
        </Link>
      </div>
      <div className="grid grid-2">
        <div className="panel">
          <h2>Lifecycle</h2>
          <p className="mono">
            Propose → Accept → Settle → SettlementReceipt
          </p>
          <p style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
            All legs run in a single Daml transaction. One failure reverts
            everything — no half-state.
          </p>
        </div>
        <div className="panel">
          <h2>Core claim</h2>
          <p style={{ color: "var(--muted)" }}>
            Per-leg privacy is ledger-enforced via Canton stakeholders — proven
            by <span className="mono">testAuditorCannotSeeLegs</span>, not a UI
            filter. The observer&apos;s token ACS is empty while the receipt is
            present.
          </p>
        </div>
      </div>
    </div>
  );
}
