"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "./BrandMark";
import { CantonWalletManager } from "./CantonWalletManager";

const NAV_LINKS = [
  { href: "/proposer", label: "Exporter", icon: "📦", desc: "Alice · Commodity originator" },
  { href: "/counterparty", label: "Lender", icon: "🏛️", desc: "Bob & Oracle · Review & co-sign" },
  { href: "/demo", label: "Settle", icon: "⚡", desc: "Lock legs & settle signed trades" },
  { href: "/readiness", label: "Readiness", icon: "📊", desc: "Leg signatures & locks" },
  { href: "/observer", label: "Auditor", icon: "🔍", desc: "Regulator · Zero-leak proof" },
  { href: "/governance", label: "BitSafe", icon: "🛡️", desc: "M-of-N threshold multi-sig" },
  { href: "/metrics", label: "Activity", icon: "📈", desc: "Ledger throughput & telemetry" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (mobileOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "";
      }
    }
    return () => {
      if (typeof document !== "undefined") {
        document.body.style.overflow = "";
      }
    };
  }, [mobileOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="site-header" role="banner">
        <div className="site-header-inner">
          {/* Brand Logo & Title */}
          <Link href="/" className="nav-brand" onClick={() => setMobileOpen(false)}>
            <BrandMark size={30} />
            <span className="nav-brand-text">
              <span className="nav-brand-name">Settle Flow</span>
              <span className="nav-brand-tag">Settlement demo</span>
            </span>
          </Link>

          {/* Desktop Navigation Links (>= 1024px) */}
          <nav className="desktop-nav" aria-label="Primary Desktop Navigation">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`desktop-nav-link ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="nav-link-text">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop & Mobile Top Actions */}
          <div className="nav-actions">
            {/* Live Desk Indicator (Hidden on small mobile) */}
            <span className="live-status-pill" title="High-fidelity in-memory ledger simulation active">
              <span className="live-pulse-dot" />
              <span className="live-status-label">Memory ledger only</span>
            </span>

            {/* Canton Wallet & Identity Switcher */}
            <CantonWalletManager />

            {/* Settle Action CTA (Desktop/Tablet only) */}
            <Link className="nav-cta-btn desktop-only" href="/proposer">
              Propose a trade
            </Link>

            {/* Mobile Hamburger Toggle Button (< 1024px) */}
            <button
              type="button"
              className={`mobile-menu-toggle ${mobileOpen ? "open" : ""}`}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
            >
              <span className="hamburger-box">
                <span className="hamburger-inner" />
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Horizontal Sub-Bar (Swipeable Desks Bar for quick mobile navigation) */}
        <div className="mobile-desk-subbar" aria-label="Mobile Desk Switcher">
          <div className="mobile-desk-subbar-track">
            {NAV_LINKS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-subbar-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="subbar-icon">{item.icon}</span>
                  <span className="subbar-label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay & Sheet */}
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        >
          <div
            id="mobile-nav-drawer"
            className="mobile-drawer-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            {/* Drawer Header */}
            <div className="mobile-drawer-header">
              <div className="mobile-drawer-title-group">
                <BrandMark size={26} />
                <div>
                  <h3 className="mobile-drawer-heading">Settle Flow</h3>
                  <span className="mobile-drawer-sub">Multi-Party DvP on Canton</span>
                </div>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Quick Settle Banner */}
            <div className="mobile-drawer-cta-card">
              <div>
                <strong>Atomic Multi-Asset Settlement</strong>
                <p>3-leg DvP for commodity and FX trades with BitSafe governance.</p>
              </div>
              <Link
                href="/demo"
                className="mobile-drawer-action-btn"
                onClick={() => setMobileOpen(false)}
              >
                Open Settlement Desk →
              </Link>
            </div>

            {/* Desk Navigation List */}
            <div className="mobile-drawer-links-section">
              <span className="mobile-drawer-section-title">Trading Desks &amp; Workspaces</span>
              <div className="mobile-drawer-links-grid">
                {NAV_LINKS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mobile-drawer-link-card ${isActive ? "active" : ""}`}
                      onClick={() => setMobileOpen(false)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className="mobile-drawer-link-icon">{item.icon}</span>
                      <div className="mobile-drawer-link-text">
                        <span className="mobile-drawer-link-title">{item.label}</span>
                        <span className="mobile-drawer-link-desc">{item.desc}</span>
                      </div>
                      {isActive && <span className="mobile-drawer-active-badge">Current</span>}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer & Canton Resources */}
            <div className="mobile-drawer-footer">
              <div className="mobile-drawer-network-status">
                <span className="live-pulse-dot" />
                <span>Demo mode · in-memory engine (not a ledger)</span>
              </div>
              <div className="mobile-drawer-ext-links">
                <a
                  href="https://dev-hub.canton.foundation/"
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-drawer-ext-tag"
                >
                  Dev Hub ↗
                </a>
                <a
                  href="https://docs.canton.network/"
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-drawer-ext-tag"
                >
                  Docs ↗
                </a>
                <a
                  href="https://ccview.io/"
                  target="_blank"
                  rel="noreferrer"
                  className="mobile-drawer-ext-tag"
                >
                  CCView ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
