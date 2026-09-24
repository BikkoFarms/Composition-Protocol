"use client";

/**
 * Observer Money Shot Page — Proving Canton Sub-Transaction Privacy
 *
 * Demonstrates the core privacy guarantee of Canton (R-PRIV-1, R-PRIV-2, R-PRIV-3):
 * - Two views of the SAME ledger state: Participant (Bob) vs Regulator.
 * - Bob holds the transferred asset tokens in his Active Contract Set (ACS).
 * - Regulator holds the SettlementReceipt (metadata, timestamp, leg status).
 * - Regulator's token ACS is strictly EMPTY: `visibleTokens: []`.
 * - Canton sub-transaction privacy cryptographically isolates non-observer contracts.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type MoneyShot = {
  participant: {
    party: string;
    visibleTokens: unknown[];
    settlementReceipts: unknown[];
  };
  observer: {
    party: string;
    visibleTokens: unknown[];
    settlementReceipts: {
      receiptCid: string | null;
      description: string;
      settledAt?: string;
      legSummaries?: { legId: string; status: string }[];
      visibleLegPayloads: unknown[];
    }[];
    proof: {
      visibleTokensEmpty: boolean;
      receiptPresent: boolean;
      test: string;
    };
  };
};

export default function ObserverPage() {
  const [data, setData] = useState<MoneyShot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const shot = await api<MoneyShot>("/audit/money-shot");
    setData(shot);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: "9999px", background: "rgba(6, 182, 212, 0.12)", border: "1px solid rgba(6, 182, 212, 0.3)", marginBottom: "0.85rem" }}>
          <span className="pulse-dot" style={{ backgroundColor: "#06b6d4", boxShadow: "0 0 10px #06b6d4" }} />
          <span className="mono" style={{ fontSize: "0.78rem", color: "#67e8f9", fontWeight: 600 }}>
            HackCanton Invariant R-PRIV-3 · Sub-Transaction Cryptographic Exclusion
          </span>
        </div>
        <h1>The Observer Money Shot</h1>
        <p className="lede">
          Two views of the exact same ledger at the exact same transaction block. The regulator observes that multi-asset settlement occurred — and <strong style={{ color: "#fff" }}>cryptographically cannot see the underlying token contracts</strong>.
        </p>
      </div>

      {error && <div className="err">{error}</div>}

      {/* Cryptographic Privacy Proof Certificate */}
      {data && (
        <div className="panel panel-glow-cyan" style={{ marginBottom: "2rem", background: "rgba(6, 182, 212, 0.05)", border: "1px solid rgba(6, 182, 212, 0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "10px", background: "rgba(6, 182, 212, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                🛡️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "#fff" }}>Canton Sub-Transaction Privacy Certificate</h3>
                <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
                  Verified by test: <code className="mono" style={{ color: "#67e8f9" }}>{data.observer.proof.test}</code>
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <span className={`tag ${data.observer.proof.visibleTokensEmpty ? "ok" : "empty"}`} style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}>
                {data.observer.proof.visibleTokensEmpty ? "✓ visibleTokens: [] (0 Leaks)" : "⚠ Token Leak Detected"}
              </span>
              <span className={`tag ${data.observer.proof.receiptPresent ? "ok" : "warn"}`} style={{ fontSize: "0.82rem", padding: "0.35rem 0.8rem" }}>
                {data.observer.proof.receiptPresent ? "✓ Receipt Disclosed" : "○ Awaiting Settle"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="split">
        {/* Bob's View */}
        <div className="panel panel-glow-accent">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2>Participant ACS (Bob / Lender)</h2>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <span className="tag ok">tokens: {data?.participant.visibleTokens.length ?? 0}</span>
              <span className="tag ok">receipts: {data?.participant.settlementReceipts.length ?? 0}</span>
            </div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
            As counterparty to Leg 1 and Leg 2, Bob is a named stakeholder on both the token contracts and the settlement receipt.
          </p>

          {data && (
            <pre className="mono">
              {JSON.stringify(data.participant, null, 2)}
            </pre>
          )}
        </div>

        {/* Regulator View */}
        <div className="panel panel-glow-cyan">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <h2>Regulator ACS (Financial Auditor)</h2>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <span className="tag ok">tokens: {data?.observer.visibleTokens.length ?? 0}</span>
              <span className="tag cyan">receipts: {data?.observer.settlementReceipts.length ?? 0}</span>
            </div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", marginBottom: "1rem" }}>
            Regulator is observer only on <code className="mono">SettlementReceipt</code>. Underlying assets are cryptographically inaccessible.
          </p>

          {data && (
            <>
              {data.observer.visibleTokens.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: "1.15rem", marginBottom: "0.4rem" }}>visibleTokens: []</div>
                  <div>Leg contracts cryptographically excluded from node storage</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)", marginTop: "0.5rem" }}>
                    Canton ledger-enforced stakeholder scoping (R-PRIV-1, R-PRIV-2, R-PRIV-3)
                  </div>
                </div>
              ) : (
                <pre className="mono">
                  {JSON.stringify(data.observer.visibleTokens, null, 2)}
                </pre>
              )}

              <h3 style={{ fontSize: "1rem", marginTop: "1.25rem", marginBottom: "0.5rem", color: "#fff" }}>
                Auditor View: SettlementReceipt
              </h3>
              {data.observer.settlementReceipts.length === 0 ? (
                <div style={{ padding: "1.5rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px", textAlign: "center", color: "var(--muted)", fontSize: "0.85rem" }} className="mono">
                  No settlement receipts found yet. Settle a composition from Pitch Demo to generate.
                </div>
              ) : (
                <pre className="mono">
                  {JSON.stringify(data.observer.settlementReceipts, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
