"use client";

/**
 * Mission Control — Lattice restyle
 * Connectivity, mode, treasury mint, circuit breaker, oracle telemetry.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type OverviewData = {
  mode: "ledger" | "demo";
  ledgerConfigured: boolean;
  ledgerUrl: string;
  packageId: string;
  packageName: string;
  oidcConfigured: boolean;
  circuitBreaker: {
    isHalted: boolean;
    haltReason: string | null;
    haltedBy: string | null;
    updatedAt: string;
  };
  metrics: {
    compositionsSettled: number;
    compositionsReverted: number;
    legsSettled: number;
  };
  parties: string[];
  treasuryReserves: Record<string, number>;
  totalActiveTokens: number;
  timestamp: string;
};

type PingResult = {
  ok: boolean;
  targetUrl: string;
  latencyMs: number;
  ledgerOffset?: string;
  message?: string;
  error?: string;
};

type OracleData = {
  ok: boolean;
  source: string;
  data: {
    symbol: string;
    price: string;
    currency: string;
    unit: string;
    signature: string;
    timestamp: string;
  };
};

export default function AdminPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [oracleQuote, setOracleQuote] = useState<OracleData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mintOwner, setMintOwner] = useState("Alice");
  const [mintAsset, setMintAsset] = useState("CBTC");
  const [mintAmount, setMintAmount] = useState("5.0");

  const refresh = useCallback(async () => {
    try {
      const data = await api<OverviewData>("/admin/overview");
      setOverview(data);
    } catch {
      /* overview may 404 if route missing */
    }
  }, []);

  const runPing = useCallback(async () => {
    try {
      const data = await api<PingResult>("/admin/ledger/ping", {
        method: "POST",
        body: "{}",
      });
      setPing(data);
    } catch {
      setPing({
        ok: false,
        targetUrl: "local",
        latencyMs: 0,
        message: "Demo / offline",
      });
    }
  }, []);

  const fetchOracle = useCallback(async () => {
    try {
      const data = await api<OracleData>("/admin/oracle/price");
      setOracleQuote(data);
    } catch {
      /* oracle optional */
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    runPing().catch(() => undefined);
    fetchOracle().catch(() => undefined);
    const interval = setInterval(() => {
      refresh().catch(() => undefined);
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh, runPing, fetchOracle]);

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api("/admin/mint", {
        method: "POST",
        body: JSON.stringify({
          owner: mintOwner,
          instrumentId: mintAsset,
          amount: mintAmount,
        }),
      });
      await refresh();
      setSuccessMsg(
        `Minted ${mintAmount} ${mintAsset} to ${mintOwner}'s ACS.`,
      );
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleHalt() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api<{ isHalted: boolean }>(
        "/compositions/circuit-breaker/toggle",
        {
          method: "POST",
          body: JSON.stringify({
            caller: "Operator",
            reason: "Operator manual safety toggle",
          }),
        },
      );
      await refresh();
      setSuccessMsg(
        res.isHalted
          ? "Circuit breaker engaged — settlements blocked."
          : "Circuit breaker reset — settlements resumed.",
      );
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleMode(newMode: "ledger" | "demo") {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api("/admin/ledger/mode", {
        method: "POST",
        body: JSON.stringify({ mode: newMode }),
      });
      await refresh();
      await runPing();
      setSuccessMsg(`Operational mode → ${newMode.toUpperCase()}`);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all test compositions and restore default portfolio?"))
      return;
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api("/admin/reset", { method: "POST", body: "{}" });
      await refresh();
      setSuccessMsg("State purged — demo tokens re-seeded.");
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const halted = overview?.circuitBreaker?.isHalted;

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Mission control
          <span className="pill-arrow">→</span>
        </span>
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <h1 className="page-title">Admin</h1>
            <p className="lede">
              Node connectivity, treasury mint, circuit breaker, and oracle
              telemetry — operator tools for LocalNet and DevNet demos.
            </p>
          </div>
          <div className="card card-mint" style={{ minWidth: 220, padding: 16 }}>
            <h2>Node latency</h2>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className={`status-dot ${ping?.ok ? "" : "warn"}`} />
              <span className={`tag ${ping?.ok ? "ok" : "warn"}`}>
                {ping?.ok ? `${ping.latencyMs}ms` : "Offline / local"}
              </span>
            </div>
            <p className="mono muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
              Offset: {ping?.ledgerOffset ?? "—"}
            </p>
            <button
              className="btn-block"
              disabled={busy}
              onClick={runPing}
              style={{ padding: "10px 14px", fontSize: 13 }}
            >
              Ping ledger
            </button>
          </div>
        </div>
      </div>

      {successMsg && <div className="flash-ok">{successMsg}</div>}
      {error && <p className="err">{error}</p>}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-mint">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <h2>Canton ledger</h2>
            <span className={`tag ${overview?.mode === "ledger" ? "ok" : "warn"}`}>
              {overview?.mode?.toUpperCase() ?? "DEMO"}
            </span>
          </div>
          <div className="row">
            <button
              className={overview?.mode === "ledger" ? "primary" : undefined}
              disabled={busy}
              onClick={() => handleToggleMode("ledger")}
            >
              Live ledger
            </button>
            <button
              className={overview?.mode === "demo" ? "primary" : undefined}
              disabled={busy}
              onClick={() => handleToggleMode("demo")}
            >
              Demo engine
            </button>
          </div>
          <table>
            <tbody>
              <tr>
                <td className="muted">Endpoint</td>
                <td className="mono" style={{ wordBreak: "break-all" }}>
                  {overview?.ledgerUrl || "—"}
                </td>
              </tr>
              <tr>
                <td className="muted">Package</td>
                <td className="mono">{overview?.packageId || "—"}</td>
              </tr>
              <tr>
                <td className="muted">OIDC</td>
                <td>
                  <span
                    className={`tag ${overview?.oidcConfigured ? "ok" : "warn"}`}
                  >
                    {overview?.oidcConfigured ? "Configured" : "Not configured"}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="muted">Client</td>
                <td className="mono">
                  {overview?.ledgerConfigured
                    ? "Ready (JSON v2)"
                    : "Simulated"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card card-blush">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <h2>Circuit breaker</h2>
            <span className={`tag ${halted ? "empty" : "ok"}`}>
              {halted ? "Halt active" : "Normal"}
            </span>
          </div>
          <p className="card-body" style={{ marginBottom: 16 }}>
            Halt all multi-asset settlements if oracle or contract risk
            appears.
          </p>
          {halted && (
            <div className="halt-banner">
              <p className="mono" style={{ margin: 0, fontSize: 13 }}>
                Reason: {overview?.circuitBreaker.haltReason ?? "Manual"}
              </p>
              <p className="mono muted" style={{ margin: "4px 0 0", fontSize: 12 }}>
                By {overview?.circuitBreaker.haltedBy} ·{" "}
                {overview?.circuitBreaker.updatedAt
                  ? new Date(
                      overview.circuitBreaker.updatedAt,
                    ).toLocaleTimeString()
                  : "—"}
              </p>
            </div>
          )}
          <div className="row">
            <button
              className={halted ? "primary" : "danger"}
              disabled={busy}
              onClick={handleToggleHalt}
            >
              {halted ? "Resume settlements" : "Emergency halt"}
            </button>
            <button disabled={busy} onClick={handleReset}>
              Reset environment
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card card-lime">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <h2>Treasury mint</h2>
            <span className="tag">Operator</span>
          </div>
          <form onSubmit={handleMint}>
            <div className="form-grid-3">
              <div className="field">
                <label>Party</label>
                <select
                  className="select"
                  value={mintOwner}
                  onChange={(e) => setMintOwner(e.target.value)}
                >
                  {(overview?.parties?.length
                    ? overview.parties
                    : ["Alice", "Bob", "Oracle"]
                  ).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Instrument</label>
                <select
                  className="select"
                  value={mintAsset}
                  onChange={(e) => setMintAsset(e.target.value)}
                >
                  <option value="CBTC">CBTC</option>
                  <option value="USDCx">USDCx</option>
                  <option value="cETH">cETH</option>
                  <option value="ATTEST">ATTEST</option>
                </select>
              </div>
              <div className="field">
                <label>Amount</label>
                <input
                  className="input"
                  value={mintAmount}
                  onChange={(e) => setMintAmount(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              className="primary btn-block"
              disabled={busy}
            >
              Mint to party ACS
            </button>
          </form>
          <div className="divider" />
          <h2>Reserves</h2>
          <div className="row" style={{ marginBottom: 0 }}>
            {Object.entries(overview?.treasuryReserves ?? {}).length === 0 ? (
              <span className="mono muted">No reserves reported</span>
            ) : (
              Object.entries(overview?.treasuryReserves ?? {}).map(
                ([symbol, qty]) => (
                  <span key={symbol} className="tag cyan">
                    {symbol}: {Number(qty).toLocaleString()}
                  </span>
                ),
              )
            )}
          </div>
        </div>

        <div className="card card-lavender">
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <h2>Oracle · :4002</h2>
            <span className="tag ok">HMAC attest</span>
          </div>
          <p className="card-body" style={{ marginBottom: 16 }}>
            Commodity spot feed with HMAC-SHA256 signature for warehouse
            certificates.
          </p>
          {oracleQuote ? (
            <div className="oracle-box">
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 500, fontSize: 18 }}>
                  {oracleQuote.data.symbol} / USD
                </span>
                <span className="stat" style={{ fontSize: 28 }}>
                  ${oracleQuote.data.price}
                </span>
              </div>
              <p className="mono muted" style={{ margin: "0 0 6px", fontSize: 12 }}>
                Source: {oracleQuote.source} · /{oracleQuote.data.unit}
              </p>
              <p
                className="mono muted"
                style={{ margin: 0, fontSize: 11, wordBreak: "break-all" }}
              >
                Sig: {oracleQuote.data.signature}
              </p>
            </div>
          ) : (
            <p className="mono muted">No quote yet — start the mock oracle.</p>
          )}
          <button
            className="btn-block"
            style={{ marginTop: 16 }}
            disabled={busy}
            onClick={fetchOracle}
          >
            Refresh oracle quote
          </button>
        </div>
      </div>

      {overview?.metrics && (
        <div className="grid grid-3" style={{ marginTop: 20 }}>
          <div className="card card-butter">
            <h2>Settled</h2>
            <p className="stat">{overview.metrics.compositionsSettled}</p>
          </div>
          <div className="card card-sage">
            <h2>Reverted</h2>
            <p className="stat">{overview.metrics.compositionsReverted}</p>
          </div>
          <div className="card card-mint">
            <h2>Legs</h2>
            <p className="stat">{overview.metrics.legsSettled}</p>
          </div>
        </div>
      )}
    </div>
  );
}
