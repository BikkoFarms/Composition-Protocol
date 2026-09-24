"use client";

/**
 * Proposer Dashboard — Alice (Commodity Exporter)
 *
 * Allows the deal initiator to:
 * 1. Inspect their active asset portfolio (e.g. CBTC collateral tokens).
 * 2. Propose new multi-asset compositions targeting specific counterparties.
 * 3. Track counterparty acceptance across the Daml AcceptanceTracker lifecycle.
 * 4. Cancel un-settled proposals if terms change.
 * 5. Execute atomic settlement once all counterparties have accepted.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Token = {
  contractId: string;
  owner: string;
  instrumentId: string;
  amount: string;
};

type Composition = {
  id: string;
  status: string;
  description: string;
  dealHash?: string;
  collateralRatio?: string;
  ltvPercent?: number;
  accepted: string[];
  counterparties: string[];
  legs: { legId: string; instrumentId: string; amount: string; cantonDomain?: string }[];
  receiptCid?: string | null;
};

export default function ProposerPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      api<{ tokens: Token[] }>("/assets?party=Alice"),
      api<{ compositions: Composition[] }>("/compositions"),
    ]);
    setTokens(t.tokens);
    setComps(c.compositions);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, [refresh]);

  async function propose(forceFail = false) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const c = await api<Composition>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ forceFail }),
      });
      await refresh();
      setSuccessMsg(`Proposed trade-finance composition ${c.id.slice(0, 8)}`);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api(`/compositions/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true }),
      });
      await refresh();
      setSuccessMsg("✓ Deal settled atomically in a single Daml transaction!");
    } catch (e) {
      setError(String((e as Error).message));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancelDeal(id: string) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api(`/compositions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ caller: "Alice" }),
      });
      await refresh();
      setSuccessMsg("✓ Deal proposal cancelled cleanly before settlement.");
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", marginBottom: "0.85rem" }}>
          <span className="pulse-dot" />
          <span className="mono" style={{ fontSize: "0.78rem", color: "#6ee7b7", fontWeight: 600 }}>
            Role Console · Alice (Commodity Exporter & Proposer)
          </span>
        </div>
        <h1>Exporter Deal Console</h1>
        <p className="lede">
          Initiate multi-asset DvP and collateralized credit facilities. Alice proposes a 3-leg trade finance deal: pledging CBTC collateral to borrow USDCx cash, gated by an inspection grade attestation.
        </p>
      </div>

      <div className="hero-actions">
        <button className="primary" disabled={busy} onClick={() => propose(false)}>
          + Propose Trade-Finance Deal
        </button>
        <button className="danger" disabled={busy} onClick={() => propose(true)}>
          Propose Failing Deal (Atomic Revert)
        </button>
      </div>

      {successMsg && (
        <div className="panel" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.08)", marginBottom: "1.5rem" }}>
          <p className="mono" style={{ color: "#6ee7b7", margin: 0, fontWeight: 600 }}>
            {successMsg}
          </p>
        </div>
      )}

      {error && <div className="err">{error}</div>}

      <div className="grid grid-2">
        {/* Alice Portfolio */}
        <div className="panel panel-glow-accent">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2>Alice Active Holdings (ACS)</h2>
            <span className="tag ok">Party: Alice</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Amount</th>
                <th>Contract ID</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)" }}>
                    No tokens currently held.
                  </td>
                </tr>
              ) : (
                tokens.map((t) => (
                  <tr key={t.contractId}>
                    <td>
                      <span className="tag ok">{t.instrumentId}</span>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: "#fff" }}>{t.amount}</td>
                    <td className="mono" style={{ color: "var(--muted)" }}>{t.contractId.slice(0, 14)}…</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Alice's Compositions */}
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2>Active Deals Pipeline ({comps.length})</h2>
            <span className="mono" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Live State</span>
          </div>

          {comps.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", background: "rgba(0,0,0,0.25)", borderRadius: "8px" }} className="mono">
              No deals initiated yet. Click &quot;+ Propose Trade-Finance Deal&quot; above.
            </div>
          ) : (
            comps.map((c) => (
              <div
                key={c.id}
                style={{
                  border: "1px solid var(--line-glass)",
                  borderRadius: "10px",
                  padding: "1rem 1.2rem",
                  marginBottom: "1rem",
                  background: "rgba(10, 18, 14, 0.75)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <span className={`tag ${c.status === "settled" ? "ok" : c.status === "accepted" ? "cyan" : c.status === "cancelled" ? "empty" : "warn"}`}>
                    {c.status}
                  </span>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                    {c.id.slice(0, 8)}…
                  </span>
                </div>

                <p style={{ margin: "0.4rem 0 0.6rem", fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>
                  {c.description}
                </p>

                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  {c.collateralRatio && (
                    <span className="mono" style={{ fontSize: "0.78rem", color: "#6ee7b7" }}>
                      Coverage: {c.collateralRatio}
                    </span>
                  )}
                  {c.ltvPercent && (
                    <span className="mono" style={{ fontSize: "0.78rem", color: "#67e8f9" }}>
                      LTV: {c.ltvPercent}%
                    </span>
                  )}
                  <span className="mono" style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                    Accepted: [{c.accepted.join(", ") || "—"}] / Required: [{c.counterparties.join(", ")}]
                  </span>
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {c.status === "accepted" && (
                    <button
                      className="primary"
                      style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
                      disabled={busy}
                      onClick={() => settle(c.id)}
                    >
                      Settle Atomically
                    </button>
                  )}

                  {(c.status === "proposed" || c.status === "partially_accepted") && (
                    <button
                      className="danger"
                      style={{ padding: "0.45rem 1rem", fontSize: "0.85rem", background: "transparent" }}
                      disabled={busy}
                      onClick={() => cancelDeal(c.id)}
                    >
                      Cancel Deal
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
