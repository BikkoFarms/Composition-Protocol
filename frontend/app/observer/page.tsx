"use client";

/**
 * Auditor desk — same ledger, different party. Human-first money shot.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";

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
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const shot = await api<MoneyShot>("/audit/money-shot");
    setData(shot);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, 3500);
    return () => clearInterval(id);
  }, [refresh]);

  const receipt = data?.observer.settlementReceipts[0];

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Auditor desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">What the regulator sees</h1>
        <p className="lede">
          Same Canton ledger as the lender. Different party. You get proof that
          settlement happened. You do not get the asset legs. That is ledger
          privacy, not a UI filter.
        </p>
      </div>

      {error && <p className="err">{error}</p>}

      <div className="split">
        <div className="card card-mint">
          <h2>Lender (participant)</h2>
          {loading && !data ? (
            <SkeletonBlock rows={5} />
          ) : data ? (
            <>
              <p className="card-title" style={{ fontSize: 20 }}>
                {data.participant.party}
              </p>
              <div className="row">
                <span className="tag ok">
                  Tokens held: {data.participant.visibleTokens.length}
                </span>
                <span className="tag ok">
                  Receipts: {data.participant.settlementReceipts.length}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                After a settled trade, the lender ACS includes the transferred
                instruments. That is expected.
              </p>
              {data.participant.visibleTokens.length > 0 && (
                <div className="asset-chips">
                  {(data.participant.visibleTokens as { instrumentId?: string; amount?: string }[])
                    .slice(0, 6)
                    .map((t, i) => (
                      <span key={i} className="tag cyan">
                        {t.instrumentId ?? "asset"} · {t.amount ?? "—"}
                      </span>
                    ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="card card-lavender">
          <h2>Regulator (observer)</h2>
          {loading && !data ? (
            <SkeletonBlock rows={6} />
          ) : data ? (
            <>
              <p className="card-title" style={{ fontSize: 20 }}>
                {data.observer.party}
              </p>
              <div className="row">
                <span
                  className={`tag ${
                    data.observer.proof.visibleTokensEmpty ? "empty" : "warn"
                  }`}
                >
                  Tokens:{" "}
                  {data.observer.proof.visibleTokensEmpty
                    ? "none visible"
                    : "leak detected"}
                </span>
                <span
                  className={`tag ${
                    data.observer.proof.receiptPresent ? "ok" : "warn"
                  }`}
                >
                  Receipt:{" "}
                  {data.observer.proof.receiptPresent ? "on file" : "waiting"}
                </span>
              </div>

              {data.observer.visibleTokens.length === 0 ? (
                <div className="empty-state">
                  visibleTokens: []
                  <br />
                  Legs cryptographically excluded
                </div>
              ) : (
                <p className="err">Unexpected tokens in observer ACS.</p>
              )}

              <h2 style={{ marginTop: 20 }}>Settlement receipt</h2>
              {!receipt ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  No receipt yet.{" "}
                  <Link className="link-arrow" href="/demo">
                    Settle a trade
                  </Link>{" "}
                  to issue one.
                </p>
              ) : (
                <div className="receipt-card">
                  <p className="card-title" style={{ fontSize: 17 }}>
                    {receipt.description || "Composition settled"}
                  </p>
                  {receipt.settledAt && (
                    <p className="mono muted" style={{ margin: "4px 0 10px" }}>
                      {new Date(receipt.settledAt).toLocaleString()}
                    </p>
                  )}
                  {receipt.legSummaries && receipt.legSummaries.length > 0 && (
                    <ul className="ticket-legs compact">
                      {receipt.legSummaries.map((leg) => (
                        <li key={leg.legId}>
                          <span>{leg.legId}</span>
                          <strong>{leg.status}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mono muted" style={{ marginTop: 10, marginBottom: 0 }}>
                    Proven by {data.observer.proof.test}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
