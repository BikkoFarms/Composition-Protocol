import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Composition Protocol",
  description:
    "Atomic, private, multi-asset settlement for Canton — African commodity trade finance demo.",
};

const links = [
  { href: "/demo", label: "Demo" },
  { href: "/proposer", label: "Proposer" },
  { href: "/counterparty", label: "Counterparty" },
  { href: "/observer", label: "Observer" },
  { href: "/governance", label: "Governance" },
  { href: "/metrics", label: "Metrics" },
  { href: "/admin", label: "Admin" },
];

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="announce">
          HackCanton Season 3 · Track 1 RWA —{" "}
          <Link href="/demo">Run the pitch demo →</Link>
        </div>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden />
              Composition Protocol
            </Link>
            <nav>
              {links.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
            <Link className="btn primary" href="/demo">
              Request demo
            </Link>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
