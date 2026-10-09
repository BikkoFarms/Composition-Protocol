"use client";

/**
 * Auditor view (R-PRIV-3) — for one settled trade, compare what the lender's
 * ACS holds against what the regulator's ACS holds. The regulator gets the
 * SettlementReceipt and nothing else; the legs never reach its ACS.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";
import { formatAmount, friendlyError } from "@/lib/trades";

type Tokenish = { instrumentId?: string; amount?: string; contractId?: string };

type Receipt = {
  compositionId?: string;
  tradeName?: string;
  receiptCid: string | null;
  description: string;
  settledAt?: string;
  legSummaries?: { legId: string; status: string; instrumentId?: string }[];
  visibleLegPayloads: unknown[];
};

type MoneyShot = {
  source?: "demo" | "ledger";
  participant: { party: string; visibleTokens: Tokenish[]; settlementReceipts: Receipt[] };
  observer: {
    party: string;
    visibleTokens: Tokenish[];
    settlementReceipts: Receipt[];
    proof: { visibleTokensEmpty: boolean; receiptPresent: boolean; test: string };
  };
};

type SettledTrade = { id: string; tradeName?: string; status: string; settledAt?: string };

export default function ObserverPage() {
  const [trades, setTrades] = useState<SettledTrade[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [data, setData] = useState<MoneyShot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTrades = useCallback(async () => {
    const res = await api<{ compositions: SettledTrade[] }>("/compositions");
    const settled = res.compositions
      .filter((c) => c.status === "settled")
      .sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
    setTrades(settled);
    setSelectedId((cur) => {
      if (cur && settled.some((c) => c.id === cur)) return cur;
      const fromUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
      if (fromUrl && settled.some((c) => c.id === fromUrl)) return fromUrl;
      return settled[0]?.id ?? "";
    });
    if (settled.length === 0) setLoading(false);
  }, []);

  const loadShot = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setData(await api<MoneyShot>(`/audit/money-shot?compositionId=${encodeURIComponent(id)}`));
      setError(null);
    } catch (e) {
      setError(friendlyError(String((e as Error).message)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrades().catch((e) => {
      setError(friendlyError(String((e as Error).message)));
      setLoading(false);
    });
    const t = setInterval(() => loadTrades().catch(() => undefined), 5000);
    return () => clearInterval(t);
  }, [loadTrades]);

  useEffect(() => {
    loadShot(selectedId);
  }, [selectedId, loadShot]);

  const receipt = data?.observer.settlementReceipts[0];
  const proved = data?.observer.proof.visibleTokensEmpty && data?.observer.proof.receiptPresent;

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Auditor view · R-PRIV-3
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">The auditor sees the receipt, not the trade</h1>
        <p className="lede">
          Pick a settled trade. On the left: what the lender&apos;s ledger view
          holds for it. On the right: what the regulator&apos;s holds — a
          settlement receipt and no leg contents. On a Canton ledger this is
          enforced by the stakeholder model (Daml test
          testAuditorCannotSeeLegs); this demo mirrors those rules in memory.
        </p>
      </div>

      {trades.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <label htmlFor="settled-trade" style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 6 }}>
            Settled trade
          </label>
          <select
            id="settled-trade"
            className="select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ width: "100%" }}
          >
            {trades.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tradeName ?? "Trade"} · #{c.id.slice(0, 8)}
                {c.settledAt ? ` · settled ${new Date(c.settledAt).toLocaleTimeString()}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {!loading && trades.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ marginTop: 0 }}>No settled trades yet, so there is nothing to audit.</p>
          <Link className="btn primary" href="/demo">
            Go to Settlement desk →
          </Link>
        </div>
      ) : (
        <div className="money-shot-stage" aria-label="Participant versus regulator ACS">
          <div className="money-shot-panel card-mint">
            <div className="money-shot-panel-head">
              <div>
                <h2>Lender&apos;s view</h2>
                <p className="query-as">Query run as {data?.participant.party ?? "Bob"}</p>
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
                <p className="card-title" style={{ fontSize: 20 }}>
                  Assets the lender now holds from this trade
                </p>
                {data.participant.visibleTokens.length === 0 ? (
                  <p className="muted" style={{ fontSize: 14 }}>
                    The lender received nothing on this trade.
                  </p>
                ) : (
                  <ul className="ticket-legs">
                    {data.participant.visibleTokens.map((t, i) => (
                      <li key={t.contractId ?? i}>
                        <span>{t.instrumentId ?? "asset"}</span>
                        <strong>{t.amount ? formatAmount(t.amount) : "—"}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mono muted" style={{ fontSize: 12, marginTop: 12 }}>
                  Full leg details visible to the lender: yes
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
                <h2>Regulator&apos;s view</h2>
                <p className="query-as">Query run as {data?.observer.party ?? "Regulator"}</p>
              </div>
              {data && (
                <span className={`tag ${data.observer.proof.visibleTokensEmpty ? "empty" : "warn"}`}>
                  {data.observer.proof.visibleTokensEmpty ? "0 tokens" : "leak"}
                </span>
              )}
            </div>
            {loading && !data ? (
              <SkeletonBlock rows={6} />
            ) : data ? (
              <>
                <div
                  className={`empty-state money-shot-empty ${proved ? "proved" : ""}`}
                  role="status"
                  aria-label="Regulator visible tokens intentionally empty"
                >
                  <span className="empty-glyph" aria-hidden>
                    ∅
                  </span>
                  <strong>visibleTokens: []</strong>
                  <span>The legs are absent from this party&apos;s ACS, not hidden by the UI.</span>
                </div>
                <h2 style={{ marginTop: 20 }}>Settlement receipt</h2>
                {receipt && (
                  <div className="receipt-card">
                    <p className="card-title" style={{ fontSize: 17 }}>
                      {receipt.tradeName ?? receipt.description}
                    </p>
                    <p className="mono muted" style={{ margin: "4px 0 10px" }}>
                      {receipt.receiptCid?.slice(0, 22)}…
                      {receipt.settledAt ? ` · ${new Date(receipt.settledAt).toLocaleString()}` : ""}
                    </p>
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
                      Amounts and assets visible to regulator: none · backed by {data.observer.proof.test}
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
