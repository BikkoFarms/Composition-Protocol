import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Composition Protocol",
  description:
    "Atomic, private, multi-asset settlement for Canton — African commodity trade finance demo.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="top">
            <Link href="/" className="brand">
              Composition Protocol
            </Link>
            <nav>
              <Link href="/proposer">Proposer</Link>
              <Link href="/counterparty">Counterparty</Link>
              <Link href="/observer">Observer</Link>
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
