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
      <h1>Observer</h1>
      <p className="lede">
        Money shot: same ledger, different party. The regulator sees that
        settlement occurred — and cryptographically cannot see leg payloads.
        <span className="mono"> visibleTokens: []</span>
      </p>
      {error && <p className="err">{error}</p>}

      <div className="split">
        <div className="panel">
          <h2>Participant (Bob)</h2>
          {data && (
            <>
              <p>
                <span className="tag ok">
                  tokens: {data.participant.visibleTokens.length}
                </span>{" "}
                <span className="tag ok">
                  receipts: {data.participant.settlementReceipts.length}
                </span>
              </p>
              <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
                {JSON.stringify(data.participant, null, 2)}
              </pre>
            </>
          )}
        </div>
        <div className="panel">
          <h2>Regulator / Observer</h2>
          {data && (
            <>
              <p>
                <span
                  className={`tag ${data.observer.proof.visibleTokensEmpty ? "empty" : "warn"}`}
                >
                  visibleTokens: {JSON.stringify(data.observer.visibleTokens)}
                </span>{" "}
                <span
                  className={`tag ${data.observer.proof.receiptPresent ? "ok" : "warn"}`}
                >
                  receipt:{" "}
                  {data.observer.proof.receiptPresent ? "found" : "none"}
                </span>
              </p>
              {data.observer.visibleTokens.length === 0 ? (
                <div className="empty-state">
                  visibleTokens: []
                  <br />
                  legs cryptographically excluded
                </div>
              ) : (
                <pre className="mono">
                  {JSON.stringify(data.observer.visibleTokens, null, 2)}
                </pre>
              )}
              <h2 style={{ marginTop: "1rem" }}>SettlementReceipt</h2>
              {data.observer.settlementReceipts.length === 0 ? (
                <p className="mono" style={{ color: "var(--muted)" }}>
                  No receipt yet — settle a composition first.
                </p>
              ) : (
                <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(data.observer.settlementReceipts, null, 2)}
                </pre>
              )}
              <p className="mono" style={{ color: "var(--muted)", marginTop: "1rem" }}>
                Proven by {data.observer.proof.test}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
