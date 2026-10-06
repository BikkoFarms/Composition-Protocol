"use client";

/**
 * Exporter desk — Alice picks a trade from the catalogue, proposes, cancels,
 * and settles DvP compositions. Surfaces cancel and disclosed-contract paths.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";
import { friendlyError, useTradeTemplates } from "@/lib/trades";

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
  tradeName?: string;
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
  "allocating",
  "ready_to_settle",
  "awaiting_governance",
]);

export default function ProposerPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const { templates, defaultId } = useTradeTemplates();
  const [templateId, setTemplateId] = useState("");
  const selectedTemplate = templates.find((t) => t.id === (templateId || defaultId));

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      api<{ tokens: Token[] }>("/assets?party=Alice"),
      api<{ compositions: Composition[] }>("/compositions"),
    ]);
    setTokens(t.tokens);
    setComps([...c.compositions].reverse());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
  }, [refresh]);

  async function propose(opts?: { forceFail?: boolean }) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await api<Composition>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({
          forceFail: opts?.forceFail ?? false,
          templateId: templateId || defaultId,
        }),
      });
      await refresh();
      setSuccess(
        opts?.forceFail
          ? `Broken ${created.tradeName ?? "trade"} staged (#${created.id.slice(0, 8)}) — settling it will revert atomically and nothing will move.`
          : `${created.tradeName ?? "Trade"} proposed (#${created.id.slice(0, 8)}). Counterparties sign on the Lender desk, then you can settle here.`,
      );
    } catch (e) {
      setError(friendlyError(String((e as Error).message)));
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      // Match agreed terms, then settle (backend also auto-allocates if needed).
      try {
        await api(`/compositions/${id}/allocate-all`, { method: "POST" });
      } catch {
        // Older backends without allocate-all: settle() will auto-allocate.
      }
      const settled = await api<Composition>(`/compositions/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true, caller: "Operator" }),
      });
      setSuccess(
        settled.status === "awaiting_governance"
          ? `Opened BitSafe gate — complete approvals on /governance.`
          : `Settled · receipt ${settled.receiptCid ?? settled.id.slice(0, 8)}`,
      );
      await refresh();
    } catch (e) {
      setError(friendlyError(String((e as Error).message)));
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
      setError(friendlyError(String((e as Error).message)));
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
        <h1 className="page-title">Propose a trade</h1>
        <p className="lede">
          You are Alice, the exporter. Pick a trade and propose it. Once the
          lender (and inspector, if the trade has one) sign, settle it here. You
          can cancel any time before settlement.
        </p>
      </div>
      <div className="row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ marginBottom: 0, minWidth: 240 }}>
          <label htmlFor="trade-type">Trade</label>
          <select
            id="trade-type"
            value={templateId || defaultId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.legs.map((l) => l.instrumentId).join(" + ")}
              </option>
            ))}
          </select>
        </div>
        <button className="primary" disabled={busy} onClick={() => propose()}>
          Propose trade
        </button>
        <button
          className="danger"
          disabled={busy}
          onClick={() => propose({ forceFail: true })}
          title="Stages a trade whose settlement fails, to show the atomic revert"
        >
          Propose broken trade
        </button>
      </div>
      {selectedTemplate && (
        <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
          {selectedTemplate.summary}
        </p>
      )}
      {error && (
        <div
          className={`notice ${error.startsWith("Settlement reverted") ? "check" : "error"}`}
          role="alert"
        >
          <p>{error}</p>
          <button className="notice-close" aria-label="Dismiss" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="notice success" role="status">
          <p>{success}</p>
          <button className="notice-close" aria-label="Dismiss" onClick={() => setSuccess(null)}>
            ×
          </button>
        </div>
      )}

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
          <h2>Your trades</h2>
          {loading && comps.length === 0 && <SkeletonBlock rows={4} />}
          {!loading && comps.length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>
              No trades yet. Propose one to start.
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
              <p style={{ margin: "6px 0 2px", fontSize: 15, fontWeight: 600 }}>
                {c.tradeName ?? "Trade"}
              </p>
              <p className="muted" style={{ margin: "0 0 6px", fontSize: 13 }}>
                {c.description}
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                Accepted {c.accepted.length}/{c.counterparties.length}
                {c.accepted.length
                  ? ` · ${c.accepted.join(", ")}`
                  : " · waiting on counterparties"}
              </p>
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
                {(c.status === "accepted" ||
                  c.status === "ready_to_settle" ||
                  c.status === "allocating") && (
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => settle(c.id)}
                  >
                    {c.status === "accepted"
                      ? "Allocate + settle"
                      : "Settle now"}
                  </button>
                )}
                {OPEN.has(c.status) && c.status !== "awaiting_governance" && (
                  <button disabled={busy} onClick={() => cancel(c.id)}>
                    Cancel trade
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
