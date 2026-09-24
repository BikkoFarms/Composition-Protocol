"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type RunFullResult = {
  composition: { id: string; status: string; description: string };
  error: string | null;
  moneyShot: {
    participant: { visibleTokens: unknown[]; settlementReceipts: unknown[] };
    observer: {
      visibleTokens: unknown[];
      settlementReceipts: unknown[];
      privacy: { claim: string };
    };
  };
  metrics: {
    compositionsSettled: number;
    compositionsReverted: number;
    legsSettled: number;
  };
};

export default function DemoPage() {
  const [result, setResult] = useState<RunFullResult | null>(null);
  const [loadStats, setLoadStats] = useState<{
    ran: number;
    metrics: RunFullResult["metrics"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);

  async function runPitch(forceFail = false) {
    setBusy(true);
    setError(null);
    setStep(1);
    try {
      await new Promise((r) => setTimeout(r, 280));
      setStep(2);
      const data = await api<RunFullResult>("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail }),
      });
      setStep(forceFail ? 3 : 4);
      setResult(data);
      if (data.error) setError(data.error);
    } catch (e) {
      setError(String((e as Error).message));
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function runFifty() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{
        ran: number;
        metrics: RunFullResult["metrics"];
      }>("/compositions/demo/load", {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      setLoadStats(data);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const observerEmpty =
    result &&
    Array.isArray(result.moneyShot.observer.visibleTokens) &&
    result.moneyShot.observer.visibleTokens.length === 0;

  return (
    <div>
      <h1>Pitch demo</h1>
      <p className="lede">
        Under five minutes: propose a three-leg trade-finance composition,
        settle atomically, then prove the observer cannot see legs.
      </p>

      <div className="row">
        <button className="primary" disabled={busy} onClick={() => runPitch(false)}>
          Run full happy path
        </button>
        <button className="danger" disabled={busy} onClick={() => runPitch(true)}>
          Run atomic revert
        </button>
        <button disabled={busy} onClick={runFifty}>
          Settle 50 (metrics)
        </button>
        <Link className="btn" href="/governance">
          BitSafe M-of-N
        </Link>
      </div>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2>Script</h2>
        <ol className="mono" style={{ color: "var(--muted)", lineHeight: 1.7 }}>
          <li style={{ color: step >= 1 ? "var(--ok)" : undefined }}>
            Propose collateral + USDCx + attestation
          </li>
          <li style={{ color: step >= 2 ? "var(--ok)" : undefined }}>
            Counterparties accept · AcceptanceTracker fills
          </li>
          <li style={{ color: step >= 3 ? (error ? "var(--danger)" : "var(--ok)") : undefined }}>
            Settle — one atomic transaction
          </li>
          <li style={{ color: step >= 4 ? "var(--accent)" : undefined }}>
            MONEY SHOT — observer visibleTokens: []
          </li>
        </ol>
      </div>

      {error && <p className="err">{error}</p>}

      {loadStats && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <h2>Load metrics</h2>
          <p className="mono">
            ran={loadStats.ran} settled={loadStats.metrics.compositionsSettled}{" "}
            reverted={loadStats.metrics.compositionsReverted} legs=
            {loadStats.metrics.legsSettled}
          </p>
        </div>
      )}

      {result && (
        <div className="split">
          <div className="panel">
            <h2>Participant (Bob)</h2>
            <span className="tag ok">
              tokens: {result.moneyShot.participant.visibleTokens.length}
            </span>
            <pre className="mono" style={{ whiteSpace: "pre-wrap", marginTop: "0.75rem" }}>
              {JSON.stringify(
                {
                  status: result.composition.status,
                  receipts: result.moneyShot.participant.settlementReceipts.length,
                  tokens: result.moneyShot.participant.visibleTokens.length,
                },
                null,
                2,
              )}
            </pre>
          </div>
          <div className="panel">
            <h2>Observer (Regulator)</h2>
            {observerEmpty ? (
              <div className="empty-state">visibleTokens: []</div>
            ) : (
              <span className="tag warn">tokens present</span>
            )}
            <p className="mono" style={{ color: "var(--muted)", marginTop: "0.75rem" }}>
              {result.moneyShot.observer.privacy.claim}
            </p>
            <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(
                {
                  visibleTokens: result.moneyShot.observer.visibleTokens,
                  receipts: result.moneyShot.observer.settlementReceipts.length,
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
