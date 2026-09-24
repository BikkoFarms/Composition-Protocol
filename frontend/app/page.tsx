import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <div>
          <span className="pill">
            Protocol · Canton
            <span className="pill-arrow">→</span>
          </span>
          <h1>Atomic. Private. Multi-asset.</h1>
          <div className="row" style={{ marginTop: 20 }}>
            <Link className="btn primary" href="/demo">
              Run pitch demo
            </Link>
            <Link className="btn" href="/observer">
              Take a tour
            </Link>
          </div>
        </div>
        <div>
          <p className="lede" style={{ marginTop: 48 }}>
            A reusable Daml primitive on Canton: bundle several asset transfers
            into one deal that either all settles or none does — each party
            seeing only its own leg. Demonstrated through African commodity
            trade finance.
          </p>
          <div className="hero-visual">
            <div className="device-frame">
              <span className="tag">SettlementReceipt</span>
              <p className="card-title" style={{ fontSize: 19 }}>
                Observer ACS
              </p>
              <div className="empty-state" style={{ padding: 20 }}>
                visibleTokens: []
              </div>
              <p className="muted" style={{ fontSize: 14, margin: 0 }}>
                Same ledger · different party · ledger-enforced privacy
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            Platform
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">One primitive, three role views</h2>
          <p className="muted" style={{ maxWidth: "34rem" }}>
            Builders call the protocol. The trade-finance flow gives it a face —
            propose, accept, settle, audit.
          </p>
        </div>
        <div className="grid grid-3">
          <article className="card card-mint">
            <div className="icon-circle">01</div>
            <h3 className="card-title">Propose</h3>
            <p className="card-body">
              Exporter opens a three-leg composition: CBTC collateral, USDCx
              cash, oracle attestation.
            </p>
            <p style={{ marginTop: 16 }}>
              <Link className="link-arrow" href="/proposer">
                Open proposer →
              </Link>
            </p>
          </article>
          <article className="card card-lime">
            <div className="icon-circle">02</div>
            <h3 className="card-title">Accept & settle</h3>
            <p className="card-body">
              Counterparties co-sign. Settle runs every Transfer in one Daml
              transaction — or reverts cleanly.
            </p>
            <p style={{ marginTop: 16 }}>
              <Link className="link-arrow" href="/counterparty">
                Counterparty view →
              </Link>
            </p>
          </article>
          <article className="card card-lavender">
            <div className="icon-circle">03</div>
            <h3 className="card-title">Observer proof</h3>
            <p className="card-body">
              Regulator sees the receipt, not the legs. Proven by
              testAuditorCannotSeeLegs — not a UI filter.
            </p>
            <p style={{ marginTop: 16 }}>
              <Link className="link-arrow" href="/observer">
                Money shot →
              </Link>
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            Why Canton
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">Privacy declared, not bolted on</h2>
        </div>
        <div className="grid grid-2">
          <article className="card card-butter">
            <h3 className="card-title">signatory + observer</h3>
            <p className="card-body">
              Per-leg visibility is Canton’s stakeholder model. No custom ZK
              circuit per asset-type × privacy config.
            </p>
          </article>
          <article className="card card-sage">
            <h3 className="card-title">Infrastructure, not a venue</h3>
            <p className="card-body">
              DEXs and funds call the primitive. We don’t compete with Temple or
              Tradecraft — we make them composable.
            </p>
          </article>
        </div>
        <div className="banner-integrations">
          <span className="pill">
            BitSafe · M-of-N
            <span className="pill-arrow">→</span>
          </span>
          <p
            style={{
              margin: "20px auto 0",
              maxWidth: 420,
              fontSize: 19,
              fontWeight: 500,
            }}
          >
            Governed settlement for the Decentralization challenge — threshold
            authorization on LocalNet.
          </p>
          <p style={{ marginTop: 20 }}>
            <Link
              className="btn"
              href="/governance"
              style={{ background: "#fff", borderColor: "#fff" }}
            >
              Open governance
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
