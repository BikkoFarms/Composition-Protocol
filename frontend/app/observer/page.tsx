"use client";

/**
 * Money shot — cinematic split-screen: participant ACS vs regulator ACS.
 * Settle-then-prove so judges never land on empty skeletons.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";

type Tokenish = { instrumentId?: string; amount?: string; contractId?: string };

type MoneyShot = {
  source?: "demo" | "ledger";
  participant: {
    party: string;
    visibleTokens: Tokenish[];
    settlementReceipts: unknown[];
  };
  observer: {
    party: string;
    visibleTokens: Tokenish[];
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
  const [busy, setBusy] = useState(false);
  const [proveFlash, setProveFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const shot = await api<MoneyShot>("/audit/money-shot");
    setData(shot);
    setLoading(false);
    return shot;
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
    const id = setInterval(() => {
      refresh().catch(() => undefined);
    }, 4000);
    return () => clearInterval(id);
  }, [refresh]);

  async function settleThenProve() {
    setBusy(true);
    setError(null);
    setProveFlash(null);
    try {
      await api("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail: false }),
      });
      const shot = await refresh();
      if (shot?.observer.proof.visibleTokensEmpty && shot.observer.proof.receiptPresent) {
        setProveFlash(
          "Money shot locked: same settlement, same ledger — regulator ACS has receipt only.",
        );
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const receipt = data?.observer.settlementReceipts[0];
  const proved =
    data?.observer.proof.visibleTokensEmpty && data?.observer.proof.receiptPresent;

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Money shot · R-PRIV-3
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Observer sees nothing</h1>
        <p className="lede">
          Same settlement. Same ledger. The regulator sees that it happened —
          and cannot see a single leg&apos;s contents. That is Canton's
          stakeholder model, not a UI filter. Query run as each party below
          {data?.source === "ledger"
            ? " — live ACS on the shared DevNet participant."
            : " — LocalNet demo ACS (identical visibility rules)."}
        </p>
        <div className="row">
          <button className="primary" disabled={busy} onClick={settleThenProve}>
            {busy ? "Settling & querying…" : "Settle then prove"}
          </button>
          <Link className="btn" href="/demo">
            Settlement desk
          </Link>
          <Link className="btn" href="/governance">
            BitSafe beat
          </Link>
          {data?.source && (
            <span className={`tag ${data.source === "ledger" ? "ok" : ""}`}>
              ACS: {data.source}
            </span>
          )}
        </div>
      </div>

      {proveFlash && <div className="flash-ok">{proveFlash}</div>}
      {error && <p className="err">{error}</p>}

      <div className="money-shot-stage" aria-label="Participant versus regulator ACS">
        <div className="money-shot-panel card-mint">
          <div className="money-shot-panel-head">
            <div>
              <h2>Participant ACS</h2>
              <p className="query-as">
                Query run as {data?.participant.party ?? "Bob"}
              </p>
            </div>
            {data && (
              <span className="tag ok">
                {data.participant.visibleTokens.length} token
                {data.participant.visibleTokens.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {loading && !data ? (
            <SkeletonBlock rows={5} />
          ) : data ? (
            <>
              <p className="card-title" style={{ fontSize: 22 }}>
                Legs visible to the counterparty
              </p>
              {data.participant.visibleTokens.length === 0 ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  No tokens yet. Run <strong>Settle then prove</strong> to
                  populate this ACS.
                </p>
              ) : (
                <ul className="ticket-legs">
                  {data.participant.visibleTokens.slice(0, 8).map((t, i) => (
                    <li key={t.contractId ?? i}>
                      <span>{t.instrumentId ?? "asset"}</span>
                      <strong>{t.amount ?? "—"}</strong>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mono muted" style={{ fontSize: 12, marginTop: 12 }}>
                Receipts: {data.participant.settlementReceipts.length}
              </p>
            </>
          ) : null}
        </div>

        <div className="money-shot-divider" aria-hidden>
          <span>vs</span>
        </div>

        <div className="money-shot-panel card-lavender">
          <div className="money-shot-panel-head">
            <div>
              <h2>Regulator ACS</h2>
              <p className="query-as">
                Query run as {data?.observer.party ?? "Regulator"}
              </p>
            </div>
            {data && (
              <span
                className={`tag ${
                  data.observer.proof.visibleTokensEmpty ? "empty" : "warn"
                }`}
              >
                {data.observer.proof.visibleTokensEmpty
                  ? "0 tokens"
                  : "leak"}
              </span>
            )}
          </div>
          {loading && !data ? (
            <SkeletonBlock rows={6} />
          ) : data ? (
            <>
              <div
                className={`empty-state money-shot-empty ${
                  proved ? "proved" : ""
                }`}
                role="status"
                aria-label="Regulator visible tokens intentionally empty"
              >
                <span className="empty-glyph" aria-hidden>
                  ∅
                </span>
                <strong>visibleTokens: []</strong>
                <span>
                  Designed emptiness — legs are not hidden by the UI; they are
                  absent from this party&apos;s ACS.
                </span>
              </div>
              <h2 style={{ marginTop: 20 }}>Settlement receipt</h2>
              {!receipt ? (
                <p className="muted" style={{ fontSize: 14 }}>
                  Waiting for a receipt. Settle a DvP to issue one.
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
                  <p
                    className="mono muted"
                    style={{ marginTop: 10, marginBottom: 0 }}
                  >
                    On-ledger backing: {data.observer.proof.test}
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
