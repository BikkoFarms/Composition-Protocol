"use client";

/**
 * Protocol Metrics & Audit Telemetry Dashboard
 *
 * Real-time monitoring for HackCanton evaluation:
 * - Settlement throughput (target ≥50 deals)
 * - Multi-asset complexity (average legs/deal)
 * - 100% atomic integrity and revert accounting
 * - Live settlement event stream
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type SettlementEvent = {
  id: string;
  type: "settled" | "reverted" | "governed";
  timestamp: string;
  legs: number;
  description: string;
  receiptCid?: string | null;
  governanceCid?: string | null;
};

type Metrics = {
  compositionsSettled: number;
  compositionsReverted: number;
  legsSettled: number;
  unexpectedFailures: number;
  governedSettlements: number;
  governanceRejections: number;
  totalAttempted: number;
  avgLegsPerComposition: number;
  successRate: number;
  revertRate: number;
  recentEvents: SettlementEvent[];
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await api<Metrics>("/audit/metrics");
    setMetrics(data);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
    const id = setInterval(() => refresh().catch(() => undefined), 2000);
    return () => clearInterval(id);
  }, [refresh]);

  async function settleFifty() {
    setBusy(true);
    setError(null);
    try {
      await api("/compositions/demo/load", {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function triggerHappyPath() {
    setBusy(true);
    setError(null);
    try {
      await api("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail: false }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function triggerRevert() {
    setBusy(true);
    setError(null);
    try {
      await api("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail: true }),
      });
      await refresh();
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const meetsFiftyCriterion = (metrics?.compositionsSettled ?? 0) >= 50;
  const progressPercent = Math.min(100, Math.round(((metrics?.compositionsSettled ?? 0) / 50) * 100));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: "9999px", background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", marginBottom: "0.85rem" }}>
            <span className="pulse-dot" />
            <span className="mono" style={{ fontSize: "0.78rem", color: "#6ee7b7", fontWeight: 600 }}>
              Live Telemetry · HackCanton On-Chain Evidence
            </span>
          </div>
          <h1>On-Chain Protocol Metrics</h1>
          <p className="lede">
            Quantitative verification of multi-asset throughput, deal complexity, cross-domain routing, and 100% atomic integrity.
          </p>
        </div>

        <div style={{ textAlign: "right", minWidth: "220px" }}>
          <span className={`tag ${meetsFiftyCriterion ? "ok" : "warn"}`} style={{ fontSize: "0.85rem", padding: "0.35rem 0.8rem" }}>
            {meetsFiftyCriterion ? "✓ Criterion Met (≥50 Settled)" : `Target Progress: ${metrics?.compositionsSettled ?? 0}/50`}
          </span>
          <div style={{ width: "100%", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "9999px", marginTop: "0.6rem", overflow: "hidden" }}>
            <div style={{ width: `${progressPercent}%`, height: "100%", background: "linear-gradient(90deg, #10b981, #06b6d4)", transition: "width 0.4s ease" }} />
          </div>
        </div>
      </div>

      <div className="hero-actions">
        <button className="primary" disabled={busy} onClick={settleFifty}>
          {busy ? "Executing Batch..." : "⚡ Execute 50 Batch Settlements (Proof)"}
        </button>
        <button disabled={busy} onClick={triggerHappyPath}>
          +1 Settle Deal (3 Legs)
        </button>
        <button className="danger" disabled={busy} onClick={triggerRevert}>
          +1 Force Atomic Revert
        </button>
      </div>

      {error && <div className="err">{error}</div>}

      {metrics && (
        <>
          <div className="grid grid-2" style={{ marginBottom: "1.75rem" }}>
            <div className="panel panel-glow-accent">
              <h2 style={{ fontSize: "0.9rem", color: "var(--muted)", textTransform: "uppercase" }}>
                Total Compositions Settled
              </h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", margin: "0.4rem 0" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 800, margin: 0, color: "#6ee7b7" }}>
                  {metrics.compositionsSettled}
                </p>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  / {metrics.totalAttempted} attempted deals
                </span>
              </div>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                100% executed in a single atomic Daml transaction (R-ATOM-1)
              </p>
            </div>

            <div className="panel panel-glow-cyan">
              <h2 style={{ fontSize: "0.9rem", color: "var(--muted)", textTransform: "uppercase" }}>
                Average Complexity / Deal
              </h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", margin: "0.4rem 0" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "3.2rem", fontWeight: 800, margin: 0, color: "#67e8f9" }}>
                  {metrics.avgLegsPerComposition.toFixed(2)}
                </p>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  legs/deal ({metrics.legsSettled} total legs settled)
                </span>
              </div>
              <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.88rem" }}>
                Multi-asset topology: Collateral (CBTC), Cash (USDCx), & Inspection (ATTEST)
              </p>
            </div>

            <div className="panel">
              <h2 style={{ fontSize: "0.9rem", color: "var(--muted)", textTransform: "uppercase" }}>
                Settlement Integrity Rates
              </h2>
              <div style={{ display: "flex", gap: "2rem", marginTop: "0.6rem" }}>
                <div>
                  <span className="mono" style={{ fontSize: "1.8rem", color: "#6ee7b7", fontWeight: 800 }}>
                    {metrics.successRate.toFixed(1)}%
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Success Rate
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line-glass)", paddingLeft: "2rem" }}>
                  <span className="mono" style={{ fontSize: "1.8rem", color: metrics.revertRate > 0 ? "var(--warn)" : "var(--muted)", fontWeight: 800 }}>
                    {metrics.revertRate.toFixed(1)}%
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Atomic Revert Rate
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.85rem 0 0", fontSize: "0.85rem" }}>
                {metrics.compositionsReverted} deals cleanly aborted with zero half-states (R-ATOM-2)
              </p>
            </div>

            <div className="panel">
              <h2 style={{ fontSize: "0.9rem", color: "var(--muted)", textTransform: "uppercase" }}>
                BitSafe Governance & Safety
              </h2>
              <div style={{ display: "flex", gap: "2rem", marginTop: "0.6rem" }}>
                <div>
                  <span className="mono" style={{ fontSize: "1.8rem", color: "#fde047", fontWeight: 800 }}>
                    {metrics.governedSettlements}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Governed Settled
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line-glass)", paddingLeft: "2rem" }}>
                  <span className="mono" style={{ fontSize: "1.8rem", color: "var(--warn)", fontWeight: 800 }}>
                    {metrics.governanceRejections}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    R-GOV-1 Rejections
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line-glass)", paddingLeft: "2rem" }}>
                  <span className="mono" style={{ fontSize: "1.8rem", color: "#6ee7b7", fontWeight: 800 }}>
                    {metrics.unexpectedFailures}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Unexpected Errors
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.85rem 0 0", fontSize: "0.85rem" }}>
                M-of-N threshold multi-sig gates rigorously enforced
              </p>
            </div>
          </div>

          {/* Live Settlement Event Feed */}
          <div className="panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <h2>Live Settlement Event Feed (Audit Trail)</h2>
              <span className="tag ok">Streaming</span>
            </div>
            <p className="mono" style={{ color: "var(--muted)", marginBottom: "1rem" }}>
              Real-time audit log of settlement transactions recorded on Canton ledger:
            </p>

            {(!metrics.recentEvents || metrics.recentEvents.length === 0) ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", background: "rgba(0,0,0,0.25)", borderRadius: "8px" }} className="mono">
                No recorded events yet. Click one of the buttons above to generate live transactions.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Composition ID</th>
                    <th>Legs</th>
                    <th>Timestamp</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentEvents.slice(0, 10).map((ev, idx) => (
                    <tr key={`${ev.id}-${idx}`}>
                      <td>
                        <span
                          className={`tag ${
                            ev.type === "settled"
                              ? "ok"
                              : ev.type === "governed"
                              ? "cyan"
                              : "danger"
                          }`}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td className="mono">{ev.id.slice(0, 10)}…</td>
                      <td className="mono">{ev.legs}</td>
                      <td className="mono" style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ color: "#fff" }}>{ev.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
