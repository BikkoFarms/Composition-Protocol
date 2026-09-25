import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero hero-product">
        <div>
          <span className="pill">
            Canton settlement
            <span className="pill-arrow">→</span>
          </span>
          <h1>Close the whole deal. Or nothing moves.</h1>
          <p className="lede">
            Composition Protocol lets exporters, lenders, and oracles settle
            collateral, cash, and attestation in one Canton transaction. Each
            party sees only its own leg. Auditors get a receipt, not the
            payloads.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <Link className="btn primary" href="/demo">
              Settle a cocoa export
            </Link>
            <Link className="btn" href="/observer">
              See the auditor view
            </Link>
          </div>
          <div className="stat-strip">
            <div>
              <p className="stat-label">Atomicity</p>
              <p className="stat-value">All or none</p>
            </div>
            <div>
              <p className="stat-label">Privacy</p>
              <p className="stat-value">Per-leg ACS</p>
            </div>
            <div>
              <p className="stat-label">Governance</p>
              <p className="stat-value">BitSafe M-of-N</p>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="device-frame desk-ticket">
            <div className="ticket-head">
              <span className="tag">Live desk</span>
              <span className="muted" style={{ fontSize: 13 }}>
                West Africa cocoa · T+0
              </span>
            </div>
            <p className="card-title" style={{ fontSize: 20 }}>
              Export settlement ticket
            </p>
            <ul className="ticket-legs">
              <li>
                <span>Collateral</span>
                <strong>12.5 CBTC</strong>
              </li>
              <li>
                <span>Cash purchase</span>
                <strong>850,000 USDCx</strong>
              </li>
              <li>
                <span>Grade attestation</span>
                <strong>Oracle · Pass</strong>
              </li>
            </ul>
            <div className="ticket-foot">
              <span className="tag ok">3 legs · one transaction</span>
              <span className="tag purple">Auditor: receipt only</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            The problem
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">
            Multi-leg trades still settle like three separate wires
          </h2>
          <p className="muted" style={{ maxWidth: "40rem" }}>
            Commodity finance needs collateral, cash, and inspection to move
            together. On public chains you get MEV and full disclosure. On
            private rails you get silos. Judges and buyers both ask the same
            thing: can this settle atomically with privacy that is real?
          </p>
        </div>
        <div className="grid grid-3">
          <article className="card card-butter">
            <h3 className="card-title">Partial fills hurt</h3>
            <p className="card-body">
              If cash moves and collateral sticks, someone is underwater. Trade
              desks will not ship that risk onto Canton.
            </p>
          </article>
          <article className="card card-blush">
            <h3 className="card-title">Full broadcast kills deals</h3>
            <p className="card-body">
              Counterparties will not put warehouse receipts and lender terms on
              a public mempool. Selective visibility is the point of Canton.
            </p>
          </article>
          <article className="card card-sage">
            <h3 className="card-title">Auditors need proof, not data</h3>
            <p className="card-body">
              Regulators need evidence that settlement occurred. They do not need
              every leg payload. That is the money shot we prove on-ledger.
            </p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            How it works
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">One desk. Four real roles.</h2>
          <p className="muted" style={{ maxWidth: "36rem" }}>
            You are not clicking through a pitch script. You open a workspace and
            do the job that role would do in production.
          </p>
        </div>
        <div className="grid grid-2">
          <Link href="/proposer" className="card card-mint role-card">
            <div className="icon-circle">Ex</div>
            <h3 className="card-title">Exporter</h3>
            <p className="card-body">
              Propose the composition: CBTC collateral, USDCx purchase, oracle
              grade. Track acceptances until settle unlocks.
            </p>
            <span className="link-arrow">Open exporter desk →</span>
          </Link>
          <Link href="/counterparty" className="card card-lime role-card">
            <div className="icon-circle">Ln</div>
            <h3 className="card-title">Lender &amp; oracle</h3>
            <p className="card-body">
              Review legs that name you. Co-sign. AcceptanceTracker fills until
              every required party is in.
            </p>
            <span className="link-arrow">Open lender desk →</span>
          </Link>
          <Link href="/demo" className="card card-lavender role-card">
            <div className="icon-circle">St</div>
            <h3 className="card-title">Settlement</h3>
            <p className="card-body">
              Run the happy path or force an atomic revert. Watch the ticket
              move from proposed to settled in one Daml transaction.
            </p>
            <span className="link-arrow">Open settlement desk →</span>
          </Link>
          <Link href="/observer" className="card card-butter role-card">
            <div className="icon-circle">Au</div>
            <h3 className="card-title">Auditor</h3>
            <p className="card-body">
              Same ledger, different party. You hold SettlementReceipt. Your
              token ACS stays empty. Proven, not filtered in the UI.
            </p>
            <span className="link-arrow">Open auditor view →</span>
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            Why Canton
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">Privacy declared in the model</h2>
        </div>
        <div className="grid grid-2">
          <article className="card">
            <h3 className="card-title">signatory + observer</h3>
            <p className="card-body">
              Per-leg visibility comes from Canton&apos;s stakeholder model. We
              do not bolt on a custom ZK circuit for every asset-type and privacy
              config.
            </p>
          </article>
          <article className="card">
            <h3 className="card-title">Infrastructure, not a venue</h3>
            <p className="card-body">
              DEXs and funds call the primitive. We make Temple-class apps and
              trade desks composable without competing for their order flow.
            </p>
          </article>
        </div>
        <div className="banner-integrations">
          <span className="pill">
            BitSafe · 2-of-3
            <span className="pill-arrow">→</span>
          </span>
          <p className="banner-copy">
            High-value compositions wait for threshold signatures before cash
            and collateral move. Below threshold rejects safely. At threshold
            settles atomically.
          </p>
          <p style={{ marginTop: 20 }}>
            <Link
              className="btn"
              href="/governance"
              style={{ background: "#fff", borderColor: "#fff" }}
            >
              Open BitSafe desk
            </Link>
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <span className="pill">
            FAQ
            <span className="pill-arrow">→</span>
          </span>
          <h2 className="section-title">Straight answers</h2>
        </div>
        <div className="faq-list">
          <details className="faq-item" open>
            <summary>What is Composition Protocol?</summary>
            <p>
              A reusable Daml primitive on Canton that bundles several asset
              transfers into one deal. Either every leg settles, or none does.
              Each participant only sees contracts they are a stakeholder of.
            </p>
          </details>
          <details className="faq-item">
            <summary>Who is this for?</summary>
            <p>
              Trade-finance desks, RWA issuers, and Canton builders who need
              atomic multi-asset settlement with selective disclosure. The cocoa
              export flow is the working example for HackCanton Track 1.
            </p>
          </details>
          <details className="faq-item">
            <summary>How is privacy proven?</summary>
            <p>
              After settlement, the auditor party holds SettlementReceipt metadata
              while <code>visibleTokens</code> stays empty. That is enforced by
              the ledger, covered by{" "}
              <code>testAuditorCannotSeeLegs</code>, not by hiding rows in the
              UI.
            </p>
          </details>
          <details className="faq-item">
            <summary>Where do I start?</summary>
            <p>
              Open the settlement desk, run a cocoa export, then switch to the
              auditor view. For multi-sig, open BitSafe and walk a 2-of-3
              governed deal.
            </p>
          </details>
        </div>
      </section>

      <section className="section cta-final">
        <h2 className="section-title">Ready when the desk is.</h2>
        <p className="muted">
          No slide deck required. Propose, accept, settle, and prove privacy on
          the same ledger the judges will ask about.
        </p>
        <div className="row">
          <Link className="btn primary" href="/demo">
            Settle a trade
          </Link>
          <Link className="btn" href="/metrics">
            View activity
          </Link>
        </div>
      </section>
    </>
  );
}
