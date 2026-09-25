import type { ReactNode } from "react";
import type { Viewport } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f7f6f2",
};

export const metadata = {
  title: "Composition Protocol",
  description:
    "Settle multi-asset trades in one atomic Canton transaction. Each party sees only its own leg.",
};

const links = [
  { href: "/demo", label: "Settle" },
  { href: "/proposer", label: "Exporter" },
  { href: "/counterparty", label: "Lender" },
  { href: "/observer", label: "Auditor" },
  { href: "/governance", label: "BitSafe" },
  { href: "/metrics", label: "Activity" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="announce">
          Live on Canton demo ledger · Cocoa export settlement with CBTC + USDCx
          {" · "}
          <Link href="/demo">Open the desk →</Link>
        </div>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand">
              <BrandMark size={30} />
              <span className="brand-text">
                <span className="brand-name">Composition</span>
                <span className="brand-sub">Protocol</span>
              </span>
            </Link>
            <nav className="nav-scroll" aria-label="Primary">
              {links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="top-actions">
              <span className="live-badge">
                <span className="status-dot" />
                Desk online
              </span>
              <Link className="btn primary" href="/demo">
                Settle a trade
              </Link>
            </div>
          </header>
          <main>{children}</main>
        </div>

        <footer className="site-footer">
          <div className="site-footer-inner">
            <div className="footer-brand-block">
              <Link href="/" className="brand">
                <BrandMark size={32} />
                <span className="brand-text">
                  <span className="brand-name">Composition Protocol</span>
                </span>
              </Link>
              <p>
                The settlement layer for Canton apps that need atomic multi-asset
                deals with ledger-enforced privacy. Built for exporters, lenders,
                and auditors who cannot afford partial settlement.
              </p>
            </div>
            <div className="footer-cols">
              <div>
                <h3>Product</h3>
                <Link href="/demo">Settlement desk</Link>
                <Link href="/proposer">Exporter workspace</Link>
                <Link href="/counterparty">Lender workspace</Link>
                <Link href="/observer">Auditor view</Link>
              </div>
              <div>
                <h3>Trust</h3>
                <Link href="/governance">BitSafe M-of-N</Link>
                <Link href="/metrics">Settlement activity</Link>
                <Link href="/admin">Mission control</Link>
              </div>
              <div>
                <h3>HackCanton</h3>
                <span>Season 3 · Track 1 RWA</span>
                <span>BitSafe Decentralization</span>
                <span>Canton JSON Ledger API v2</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© {new Date().getFullYear()} Composition Protocol</span>
            <span>TradFi settlement discipline · Canton privacy</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
