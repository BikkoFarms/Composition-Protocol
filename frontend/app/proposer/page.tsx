"use client";

/**
 * Exporter desk — Alice proposes, cancels, expires, and settles DvP compositions.
 * Surfaces John's cancel / expire / disclosed-contract paths in the Lattice UI.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";

type Token = {
  contractId: string;
  owner: string;
  instrumentId: string;
  amount: string;
};

type DisclosedContract = {
  templateId: string;
  contractId: string;
  payload?: Record<string, unknown>;
};

type Composition = {
  id: string;
  status: string;
  description: string;
  accepted: string[];
  counterparties: string[];
  legs: { legId: string; instrumentId: string; amount: string }[];
  receiptCid?: string | null;
  expiresAt?: string;
  disclosedContracts?: DisclosedContract[];
  rejectionReason?: string;
};

const OPEN = new Set([
  "proposed",
  "partially_accepted",
  "accepted",
  "awaiting_governance",
]);

export default function ProposerPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      api<{ tokens: Token[] }>("/assets?party=Alice"),
      api<{ compositions: Composition[] }>("/compositions"),
    ]);
    setTokens(t.tokens);
    setComps(c.compositions);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
  }, [refresh]);

  async function propose(opts?: { forceFail?: boolean; shortLived?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await api("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({
          forceFail: opts?.forceFail ?? false,
          expiresAt: opts?.shortLived
            ? new Date(Date.now() + 8_000).toISOString()
            : undefined,
        }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ caller: "Alice" }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function expire(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/${id}/expire`, {
        method: "POST",
        body: JSON.stringify({ caller: "Operator", force: true }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Exporter desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Initiate the DvP proposal</h1>
        <p className="lede">
          You are Alice. Stage the reusable 3-party settlement pattern: CBTC
          collateral, USDCx cash, and cETH. Cancel or expire before settlement
          if the market moves.
        </p>
      </div>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => propose()}>
          Initiate proposal
        </button>
        <button disabled={busy} onClick={() => propose({ shortLived: true })}>
          Propose short-lived ticket
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() => propose({ forceFail: true })}
        >
          Propose broken ticket
        </button>
      </div>
      {error && <p className="err">{error}</p>}

      <div className="grid grid-2">
        <div className="card card-mint">
          <h2>Your holdings</h2>
          {loading && tokens.length === 0 ? (
            <SkeletonBlock rows={4} />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Amount</th>
                  <th>CID</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t) => (
                  <tr key={t.contractId}>
                    <td>{t.instrumentId}</td>
                    <td>{t.amount}</td>
                    <td className="mono">{t.contractId.slice(0, 12)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2>Your tickets</h2>
          {loading && comps.length === 0 && <SkeletonBlock rows={4} />}
          {!loading && comps.length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>
              No tickets yet. Initiate a proposal to start the workflow.
            </p>
          )}
          {comps.map((c) => (
            <div key={c.id} className="deal-card">
              <div className="deal-card-head">
                <span
                  className={`tag ${
                    c.status === "settled"
                      ? "ok"
                      : c.status === "cancelled" ||
                          c.status === "expired" ||
                          c.status === "rejected" ||
                          c.status === "reverted"
                        ? "warn"
                        : "ok"
                  }`}
                >
                  {c.status.replaceAll("_", " ")}
                </span>
                <span className="mono muted">{c.id.slice(0, 8)}</span>
              </div>
              <p className="muted" style={{ margin: "6px 0", fontSize: 14 }}>
                {c.description}
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                Accepted {c.accepted.length}/{c.counterparties.length}
                {c.accepted.length
                  ? ` · ${c.accepted.join(", ")}`
                  : " · waiting on counterparties"}
              </p>
              {c.expiresAt && OPEN.has(c.status) && (
                <p className="mono muted" style={{ fontSize: 12, margin: "6px 0" }}>
                  Expires {new Date(c.expiresAt).toLocaleString()}
                </p>
              )}
              {c.disclosedContracts && c.disclosedContracts.length > 0 && (
                <div className="asset-chips">
                  {c.disclosedContracts.map((d) => (
                    <span key={d.contractId} className="tag cyan">
                      Disclosed · {String(d.payload?.instrumentId ?? "contract")}
                    </span>
                  ))}
                </div>
              )}
              {c.rejectionReason && (
                <p className="err" style={{ marginTop: 8 }}>
                  {c.rejectionReason}
                </p>
              )}
              <div className="row" style={{ marginTop: 10, marginBottom: 0 }}>
                {c.status === "accepted" && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => settle(c.id)}
                  >
                    Settle now
                  </button>
                )}
                {OPEN.has(c.status) && c.status !== "accepted" && (
                  <button disabled={busy} onClick={() => cancel(c.id)}>
                    Cancel proposal
                  </button>
                )}
                {OPEN.has(c.status) && (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => expire(c.id)}
                  >
                    Run expiry path
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
