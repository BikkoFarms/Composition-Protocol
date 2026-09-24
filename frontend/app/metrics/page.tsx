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
      <span className="pill">
        Metrics · Validation
        <span className="pill-arrow">→</span>
      </span>
      <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.9rem)" }}>On-chain metrics</h1>
      <p className="lede">
        Compositions settled, legs per deal, success/revert rate. Target: ≥50
        settlements, zero unexpected failures.
      </p>
      <div className="row">
        <button className="primary" onClick={settleFifty}>
          Run 50 settlements
        </button>
      </div>
      {error && <p className="err">{error}</p>}
      {metrics && (
        <div className="grid grid-3">
          <div className="card card-mint">
            <h2>Settled</h2>
            <p className="stat">{metrics.compositionsSettled}</p>
          </div>
          <div className="card card-butter">
            <h2>Reverted (atomic)</h2>
            <p className="stat">{metrics.compositionsReverted}</p>
          </div>
          <div className="card card-lime">
            <h2>Legs settled</h2>
            <p className="stat">{metrics.legsSettled}</p>
          </div>
          <div className="card card-blush">
            <h2>Unexpected failures</h2>
            <p className="stat">{metrics.unexpectedFailures}</p>
          </div>
          <div className="card card-lavender">
            <h2>Governed settlements</h2>
            <p className="stat">{metrics.governedSettlements}</p>
          </div>
          <div className="card card-sage">
            <h2>Governance rejections</h2>
            <p className="stat">{metrics.governanceRejections}</p>
          </div>
        </div>
      )}
    </div>
  );
}
