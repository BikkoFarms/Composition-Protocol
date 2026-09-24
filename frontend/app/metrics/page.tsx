"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Metrics = {
  compositionsSettled: number;
  compositionsReverted: number;
  legsSettled: number;
  unexpectedFailures: number;
  governedSettlements: number;
  governanceRejections: number;
};

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
    try {
      await api("/compositions/demo/load", {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    }
  }

  return (
    <div>
      <h1>On-chain metrics</h1>
      <p className="lede">
        HackCanton Metrics criterion — compositions settled, legs per deal,
        success/revert rate. Target: ≥50 settlements, zero unexpected failures.
      </p>
      <div className="row">
        <button className="primary" onClick={settleFifty}>
          Run 50 settlements
        </button>
      </div>
      {error && <p className="err">{error}</p>}
      {metrics && (
        <div className="grid grid-2">
          <div className="panel">
            <h2>Settled</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.compositionsSettled}
            </p>
          </div>
          <div className="panel">
            <h2>Reverted (atomic)</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.compositionsReverted}
            </p>
          </div>
          <div className="panel">
            <h2>Legs settled</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.legsSettled}
            </p>
          </div>
          <div className="panel">
            <h2>Unexpected failures</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.unexpectedFailures}
            </p>
          </div>
          <div className="panel">
            <h2>Governed settlements</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.governedSettlements}
            </p>
          </div>
          <div className="panel">
            <h2>Governance rejections</h2>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", margin: 0 }}>
              {metrics.governanceRejections}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
