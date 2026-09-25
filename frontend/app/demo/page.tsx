"use client";

/**
 * Settlement desk — product flow for proposing, settling, and proving privacy.
 * Same backend demo endpoints; framed as a working desk, not a pitch script.
 */

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

const PHASES = [
  { id: 0, label: "Ready", hint: "Ticket staged · cocoa export" },
  { id: 1, label: "Proposed", hint: "Collateral + cash + attestation" },
  { id: 2, label: "Accepted", hint: "Lender and oracle co-signed" },
  { id: 3, label: "Settling", hint: "One atomic Canton transaction" },
  { id: 4, label: "Settled", hint: "Receipt issued · privacy holds" },
];

export default function DemoPage() {
  const [result, setResult] = useState<RunFullResult | null>(null);
  const [loadStats, setLoadStats] = useState<{
    ran: number;
    metrics: RunFullResult["metrics"];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [mode, setMode] = useState<"idle" | "happy" | "revert">("idle");

  async function settleTrade(forceFail = false) {
    setBusy(true);
    setError(null);
    setResult(null);
    setMode(forceFail ? "revert" : "happy");
    setPhase(1);
    try {
      await new Promise((r) => setTimeout(r, 420));
      setPhase(2);
      await new Promise((r) => setTimeout(r, 320));
      setPhase(3);
      const data = await api<RunFullResult>("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail }),
      });
      setResult(data);
      if (data.error) {
        setError(data.error);
        setPhase(3);
      } else {
        setPhase(4);
      }
    } catch (e) {
      setError(String((e as Error).message));
      setPhase(3);
    } finally {
      setBusy(false);
    }
  }

  async function runBatch() {
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

  const phaseLabel = PHASES.find((p) => p.id === phase)?.label ?? "Ready";

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Settlement desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Settle a cocoa export</h1>
        <p className="lede">
          Open a three-leg ticket: CBTC collateral, USDCx cash, and grade
          attestation. Counterparties accept. Settlement runs as one Canton
          transaction, then the auditor proves they cannot see the legs.
        </p>
      </div>

      <div className="desk-layout">
        <div className="card desk-panel">
          <h2>Ticket</h2>
          <p className="card-title" style={{ fontSize: 22, marginBottom: 4 }}>
            West Africa cocoa · T+0
          </p>
          <p className="muted" style={{ marginBottom: 20, fontSize: 14 }}>
            Status: <strong>{phaseLabel}</strong>
            {mode === "revert" ? " · testing atomic revert" : ""}
          </p>

          <ul className="ticket-legs">
            <li>
              <span>Leg A · Collateral</span>
              <strong>12.5 CBTC → Lender</strong>
            </li>
            <li>
              <span>Leg B · Purchase</span>
              <strong>850,000 USDCx → Exporter</strong>
            </li>
            <li>
              <span>Leg C · Attestation</span>
              <strong>Oracle grade · Pass</strong>
            </li>
          </ul>

          <div className="phase-rail" role="list">
            {PHASES.filter((p) => p.id > 0).map((p) => (
              <div
                key={p.id}
                role="listitem"
                className={`phase-chip ${
                  phase > p.id ? "done" : phase === p.id ? "active" : ""
                } ${error && phase === p.id ? "fail" : ""}`}
              >
                <span className="phase-n">{p.id}</span>
                <div>
                  <strong>{p.label}</strong>
                  <span>{p.hint}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginBottom: 0, marginTop: 8 }}>
            <button
              className="primary"
              disabled={busy}
              onClick={() => settleTrade(false)}
            >
              {busy && mode === "happy" ? "Settling…" : "Settle this trade"}
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={() => settleTrade(true)}
            >
              Test atomic revert
            </button>
          </div>
          <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
            Prefer role-by-role?{" "}
            <Link className="link-arrow" href="/proposer">
              Exporter
            </Link>
            {" · "}
            <Link className="link-arrow" href="/counterparty">
              Lender
            </Link>
            {" · "}
            <Link className="link-arrow" href="/observer">
              Auditor
            </Link>
          </p>
        </div>

        <div className="stack-sm desk-side">
          <div className="card card-mint">
            <h2>What you are proving</h2>
            <ul className="proof-list">
              <li>All three legs commit together or none do</li>
              <li>Lender holds tokens after a happy path</li>
              <li>Auditor holds a receipt with empty token ACS</li>
            </ul>
          </div>
          <div className="card card-lime">
            <h2>Load the desk</h2>
            <p className="card-body" style={{ marginBottom: 14 }}>
              Push fifty settlements to fill the activity board for judges.
            </p>
            <button disabled={busy} onClick={runBatch}>
              Settle 50 tickets
            </button>
            {loadStats && (
              <p className="mono" style={{ marginTop: 12, marginBottom: 0 }}>
                {loadStats.ran} ran · {loadStats.metrics.compositionsSettled}{" "}
                settled · {loadStats.metrics.legsSettled} legs
              </p>
            )}
          </div>
          <div className="card card-lavender">
            <h2>BitSafe</h2>
            <p className="card-body" style={{ marginBottom: 14 }}>
              Need threshold signatures before cash moves?
            </p>
            <Link className="btn" href="/governance">
              Open BitSafe desk
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div className="card card-blush" style={{ marginTop: 20 }}>
          <h2>Atomic revert</h2>
          <p className="err" style={{ marginBottom: 0 }}>
            {error}
          </p>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            No partial state. Collateral, cash, and attestation all rolled back.
          </p>
        </div>
      )}

      {result && !result.error && (
        <div className="split" style={{ marginTop: 28 }}>
          <div className="card card-mint">
            <h2>Lender view</h2>
            <p className="card-title" style={{ fontSize: 20 }}>
              Assets received
            </p>
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="tag ok">
                Tokens: {result.moneyShot.participant.visibleTokens.length}
              </span>
              <span className="tag ok">
                Receipts:{" "}
                {result.moneyShot.participant.settlementReceipts.length}
              </span>
            </div>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Deal {result.composition.id.slice(0, 8)} ·{" "}
              {result.composition.status}
            </p>
          </div>
          <div className="card card-lavender">
            <h2>Auditor view</h2>
            <p className="card-title" style={{ fontSize: 20 }}>
              Privacy check
            </p>
            {observerEmpty ? (
              <div className="empty-state" style={{ marginTop: 8 }}>
                visibleTokens: []
                <br />
                Legs not in auditor ACS
              </div>
            ) : (
              <span className="tag warn">Unexpected tokens present</span>
            )}
            <p className="muted" style={{ marginTop: 12, fontSize: 14 }}>
              {result.moneyShot.observer.privacy.claim}
            </p>
            <Link className="link-arrow" href="/observer">
              Open full auditor desk →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
