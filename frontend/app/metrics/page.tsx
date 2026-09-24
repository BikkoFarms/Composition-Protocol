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
    } catch {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const meetsFiftyCriterion = (metrics?.compositionsSettled ?? 0) >= 50;

  return (
    <div>
      <span className="pill">
        Metrics · Validation
        <span className="pill-arrow">→</span>
      </span>
      <div
        className="row"
        style={{ justifyContent: "space-between", alignItems: "flex-start" }}
      >
        <div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.9rem)" }}>
            On-chain metrics
          </h1>
          <p className="lede">
            Throughput, deal complexity, and atomic settlement integrity.
            Target: ≥50 settlements, zero unexpected failures.
          </p>
        </div>
        <span className={`tag ${meetsFiftyCriterion ? "ok" : "warn"}`}>
          {meetsFiftyCriterion
            ? "Criterion met (≥50 settled)"
            : "Target ≥50 deals"}
        </span>
      </div>

      <div className="row">
        <button className="primary" disabled={busy} onClick={settleFifty}>
          {busy ? "Executing…" : "Run 50 settlements"}
        </button>
        <button disabled={busy} onClick={triggerHappyPath}>
          +1 settle (3 legs)
        </button>
        <button className="danger" disabled={busy} onClick={triggerRevert}>
          +1 force atomic revert
        </button>
      </div>

      {error && <p className="err">{error}</p>}

      {metrics && (
        <>
          <div className="grid grid-2" style={{ marginBottom: 20 }}>
            <div className="card card-mint">
              <h2>Total compositions settled</h2>
              <p className="stat">{metrics.compositionsSettled}</p>
              <p className="mono muted" style={{ marginTop: 8 }}>
                / {metrics.totalAttempted} attempted
              </p>
            </div>
            <div className="card card-lime">
              <h2>Average legs / deal</h2>
              <p className="stat">
                {Number(metrics.avgLegsPerComposition ?? 0).toFixed(2)}
              </p>
              <p className="mono muted" style={{ marginTop: 8 }}>
                {metrics.legsSettled} total legs settled
              </p>
            </div>
            <div className="card card-butter">
              <h2>Settlement integrity</h2>
              <div className="row" style={{ marginTop: 8 }}>
                <div>
                  <p className="stat" style={{ fontSize: 36 }}>
                    {Number(metrics.successRate ?? 0).toFixed(1)}%
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Success
                  </p>
                </div>
                <div>
                  <p className="stat" style={{ fontSize: 36 }}>
                    {Number(metrics.revertRate ?? 0).toFixed(1)}%
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Atomic revert
                  </p>
                </div>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
                {metrics.compositionsReverted} deals aborted with zero
                half-states
              </p>
            </div>
            <div className="card card-lavender">
              <h2>BitSafe & safety</h2>
              <div className="row" style={{ marginTop: 8 }}>
                <div>
                  <p className="stat" style={{ fontSize: 36 }}>
                    {metrics.governedSettlements}
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Governed
                  </p>
                </div>
                <div>
                  <p className="stat" style={{ fontSize: 36 }}>
                    {metrics.governanceRejections}
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    R-GOV-1 rejects
                  </p>
                </div>
                <div>
                  <p className="stat" style={{ fontSize: 36 }}>
                    {metrics.unexpectedFailures}
                  </p>
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Unexpected
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Live settlement event feed</h2>
            {!metrics.recentEvents || metrics.recentEvents.length === 0 ? (
              <p className="mono muted">
                No events yet. Use the buttons above to generate transactions.
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Composition</th>
                    <th>Legs</th>
                    <th>Time</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.recentEvents.slice(0, 10).map((ev, idx) => (
                    <tr key={`${ev.id}-${idx}`}>
                      <td>
                        <span
                          className={`tag ${
                            ev.type === "reverted" ? "empty" : "ok"
                          }`}
                        >
                          {ev.type}
                        </span>
                      </td>
                      <td className="mono">{ev.id.slice(0, 10)}…</td>
                      <td className="mono">{ev.legs}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="muted">{ev.description}</td>
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
