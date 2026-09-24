"use client";

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
    } catch (e) {
      // 409 Conflict is expected for atomic revert
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const meetsFiftyCriterion = (metrics?.compositionsSettled ?? 0) >= 50;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1>On-chain protocol metrics</h1>
          <p className="lede">
            HackCanton Metrics validation criteria: multi-asset throughput, deal complexity,
            and 100% atomic settlement integrity.
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={`tag ${meetsFiftyCriterion ? "ok" : "warn"}`}>
            {meetsFiftyCriterion ? "✓ Criterion Met (≥50 Settled)" : "Criterion: Target ≥50 Deals"}
          </span>
        </div>
      </div>

      <div className="row" style={{ marginBottom: "1.5rem" }}>
        <button className="primary" disabled={busy} onClick={settleFifty}>
          {busy ? "Executing..." : "Run 50 settlements (HackCanton Evidence)"}
        </button>
        <button disabled={busy} onClick={triggerHappyPath}>
          +1 Settle deal (3 legs)
        </button>
        <button className="danger" disabled={busy} onClick={triggerRevert}>
          +1 Force atomic revert
        </button>
      </div>

      {error && <p className="err">{error}</p>}

      {metrics && (
        <>
          <div className="grid grid-2" style={{ marginBottom: "1.5rem" }}>
            <div className="panel">
              <h2>Total Compositions Settled</h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "2.8rem", margin: 0, color: "var(--ok)" }}>
                  {metrics.compositionsSettled}
                </p>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  / {metrics.totalAttempted} attempted
                </span>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.5rem 0 0", fontSize: "0.88rem" }}>
                All legs executed in a single atomic Daml transaction (R-ATOM-1)
              </p>
            </div>

            <div className="panel">
              <h2>Average Legs / Deal</h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
                <p style={{ fontFamily: "var(--font-display)", fontSize: "2.8rem", margin: 0, color: "var(--accent)" }}>
                  {metrics.avgLegsPerComposition.toFixed(2)}
                </p>
                <span className="mono" style={{ color: "var(--muted)" }}>
                  legs avg ({metrics.legsSettled} total legs settled)
                </span>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.5rem 0 0", fontSize: "0.88rem" }}>
                Multi-asset topology: Collateral, Liquidity Cash, and Oracle Grade
              </p>
            </div>

            <div className="panel">
              <h2>Settlement Integrity Rates</h2>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
                <div>
                  <span className="mono" style={{ fontSize: "1.6rem", color: "var(--ok)", fontWeight: "bold" }}>
                    {metrics.successRate.toFixed(1)}%
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Success Rate
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "1.5rem" }}>
                  <span className="mono" style={{ fontSize: "1.6rem", color: metrics.revertRate > 0 ? "var(--warn)" : "var(--muted)", fontWeight: "bold" }}>
                    {metrics.revertRate.toFixed(1)}%
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Atomic Revert Rate
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.75rem 0 0", fontSize: "0.85rem" }}>
                {metrics.compositionsReverted} deals cleanly aborted with zero half-states (R-ATOM-2)
              </p>
            </div>

            <div className="panel">
              <h2>BitSafe Governance & Safety</h2>
              <div style={{ display: "flex", gap: "1.5rem", marginTop: "0.5rem" }}>
                <div>
                  <span className="mono" style={{ fontSize: "1.6rem", color: "var(--accent)", fontWeight: "bold" }}>
                    {metrics.governedSettlements}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Governed Settled
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "1.5rem" }}>
                  <span className="mono" style={{ fontSize: "1.6rem", color: "var(--warn)", fontWeight: "bold" }}>
                    {metrics.governanceRejections}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    R-GOV-1 Rejections
                  </p>
                </div>
                <div style={{ borderLeft: "1px solid var(--line)", paddingLeft: "1.5rem" }}>
                  <span className="mono" style={{ fontSize: "1.6rem", color: "var(--ok)", fontWeight: "bold" }}>
                    {metrics.unexpectedFailures}
                  </span>
                  <p style={{ margin: "0.2rem 0 0", color: "var(--muted)", fontSize: "0.85rem" }}>
                    Unexpected Errors
                  </p>
                </div>
              </div>
              <p style={{ color: "var(--muted)", margin: "0.75rem 0 0", fontSize: "0.85rem" }}>
                M-of-N threshold multi-sig gates rigorously enforced
              </p>
            </div>
          </div>

          <div className="panel">
            <h2>Live Settlement Event Feed</h2>
            <p className="mono" style={{ color: "var(--muted)", marginBottom: "0.75rem" }}>
              Real-time audit log of settlement transactions recorded on the ledger:
            </p>
            {(!metrics.recentEvents || metrics.recentEvents.length === 0) ? (
              <p className="mono" style={{ color: "var(--muted)" }}>
                No recorded events yet. Click one of the buttons above to generate live transactions.
              </p>
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
                              ? "ok"
                              : "danger"
                          }`}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td className="mono">{ev.id.slice(0, 10)}…</td>
                      <td className="mono">{ev.legs}</td>
                      <td className="mono" style={{ fontSize: "0.82rem" }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td style={{ color: "var(--muted)" }}>{ev.description}</td>
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
