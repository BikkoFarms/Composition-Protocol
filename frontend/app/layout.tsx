import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Composition Protocol · Canton Network",
  description:
    "Atomic, private, multi-asset settlement primitive built on Canton — African commodity trade finance demo for HackCanton Season 3.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top-header">
            <div className="top-bar">
              <Link href="/" className="brand">
                <div className="brand-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <span>Composition Protocol</span>
              </Link>

              <nav>
                <Link href="/demo">Pitch Demo</Link>
                <Link href="/proposer">Proposer</Link>
                <Link href="/counterparty">Counterparty</Link>
                <Link href="/observer">Observer (Money Shot)</Link>
                <Link href="/governance">BitSafe Governance</Link>
                <Link href="/metrics">Protocol Metrics</Link>
                <Link href="/admin" style={{ color: "#c4b5fd" }}>Admin Console</Link>
              </nav>

              <div className="live-badge" title="Canton Sub-Transaction Privacy Active">
                <span className="pulse-dot" />
                <span>Canton DevNet</span>
              </div>
            </div>
          </header>

          <main>{children}</main>

          <footer style={{ marginTop: "5rem", paddingTop: "2rem", borderTop: "1px solid var(--line-glass)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className="brand" style={{ fontSize: "1rem" }}>Composition Protocol</span>
              <span>·</span>
              <span>HackCanton Season 3</span>
              <span className="tag ok" style={{ fontSize: "0.72rem" }}>Track 1 Primary</span>
              <span className="tag cyan" style={{ fontSize: "0.72rem" }}>BitSafe Challenge</span>
            </div>
            <div className="mono" style={{ fontSize: "0.8rem", color: "var(--subtle)" }}>
              Daml 3.x / Canton Ledger API v2 · Single-Tx Atomicity Guaranteed
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
