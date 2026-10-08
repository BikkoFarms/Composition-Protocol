import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero hero-product">
        <div>
          <span className="pill">
            SettleFlow
            <span className="pill-arrow">→</span>
          </span>
          <h1>Close the whole deal. Or nothing moves.</h1>
          <p className="lede">
            A reusable Daml package for structured settlement on Canton. Pick a
            trade (cocoa, coffee, cashew, gold, shea, sesame, cotton or an FX
            swap) and every leg settles in one atomic transaction. Counterparties
            co-sign agreed legs, holdings transfer with sub-transaction privacy,
            and auditors get a zero-leak receipt with payloads blinded.
          </p>
          <div className="row" style={{ marginTop: 8 }}>
            <Link className="btn primary" href="/proposer">
              Propose a trade
            </Link>
            <Link className="btn" href="/observer">
              Auditor view
            </Link>
          </div>
          <div className="stat-strip">
            <div>
              <p className="stat-label">Atomicity</p>
              <p className="stat-value">All or none</p>
            </div>
            <div>
              <p className="stat-label">Audit Privacy</p>
              <p className="stat-value">Zero-leak ACS</p>
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
                <strong>CBTC</strong>
              </li>
              <li>
                <span>Cash</span>
                <strong>USDCx</strong>
              </li>
              <li>
                <span>Sponsor asset</span>
                <strong>cETH</strong>
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
            Commodity finance needs collateral, cash, and a sponsor asset to
            move together. On public chains you get MEV and full disclosure. On
            private rails you get silos. The package answer: reusable
            propose/accept/disclose/expire/settle — demonstrated as 3-party DvP.
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
              Step 1. Pick a trade (cocoa, coffee, gold…) and propose it. Mark
              high-value trades for BitSafe 2-of-3 approval.
            </p>
            <span className="link-arrow">Open exporter desk →</span>
          </Link>
          <Link href="/counterparty" className="card card-lime role-card">
            <div className="icon-circle">Ln</div>
            <h3 className="card-title">Lender &amp; oracle</h3>
            <p className="card-body">
              Step 2. Review the legs that name you and sign, or reject. Once
              every counterparty signs, the trade goes to settlement.
            </p>
            <span className="link-arrow">Open lender desk →</span>
          </Link>
          <Link href="/demo" className="card card-lavender role-card">
            <div className="icon-circle">St</div>
            <h3 className="card-title">Settlement</h3>
            <p className="card-body">
              Step 3. Each party locks its leg; wrong amounts are refused. Then
              every leg settles in one transaction, or none do.
            </p>
            <span className="link-arrow">Open settlement desk →</span>
          </Link>
          <Link href="/observer" className="card card-butter role-card">
            <div className="icon-circle">Au</div>
            <h3 className="card-title">Auditor</h3>
            <p className="card-body">
              Step 4. Pick any settled trade: you hold its SettlementReceipt and
              no leg contents. Proven by the ledger, not filtered in the UI.
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
            <summary>What is SettleFlow?</summary>
            <p>
              SettleFlow is a reusable Daml package for structured settlement
              workflows on Canton. Builders get propose/accept coordination,
              disclosed contracts, expiry/cancel paths, and atomic settlement
              completion without rewriting that plumbing for every use case.
              The settlement desk ships eight working trades, from the 3-party
              cocoa DvP (CBTC / USDCx / cETH) to a 2-party naira FX swap.
            </p>
          </details>
          <details className="faq-item">
            <summary>Who is this for?</summary>
            <p>
              Trade-finance desks, RWA issuers, and Canton builders who need
              atomic multi-asset settlement with selective disclosure. Cocoa,
              coffee, cashew, gold, shea, sesame, cotton and FX trades are the
              working examples for HackCanton Track 1.
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
              Propose on the Exporter desk, sign on the Lender desk, then lock
              and settle on the Settlement desk. Open the Auditor view for that
              trade. For high-value trades, tick BitSafe when proposing: two of
              three governors must approve before it settles.
            </p>
          </details>
        </div>
      </section>

      <section className="section cta-final">
        <h2 className="section-title">Ready when the desk is.</h2>
        <p className="muted">
          No slide deck required. Propose, allocate (match), settle, and prove
          privacy on the same ledger the judges will ask about.
        </p>
        <div className="row">
          <Link className="btn primary" href="/proposer">
            Propose a trade
          </Link>
          <Link className="btn" href="/observer">
            Money shot
          </Link>
        </div>
      </section>
    </>
  );
}
