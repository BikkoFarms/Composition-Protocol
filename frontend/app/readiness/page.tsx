"use client";

/**
 * Trade readiness dashboard (PRD §8 · FR-11).
 * One place to see who has signed, which legs are locked, and what to do next —
 * including after settlement (every row keeps a status and an action).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";
import { formatAmount, friendlyError, roleName, useTradeTemplates } from "@/lib/trades";

type AllocatedLeg = {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: string;
  receiver: string;
  matched: boolean;
  allocationCid?: string;
  settled?: boolean;
};

type OutstandingLeg = {
  legId: string;
  provider: string;
  receiver: string;
  instrumentId: string;
  amount: string;
};

type PartyStatus = { party: string; accepted: boolean; allocated?: boolean };

type ReadinessData = {
  compositionId: string;
  tradeName?: string;
  description?: string;
  receiptCid?: string | null;
  settledAt?: string;
  governanceCid?: string | null;
  requireGovernance?: boolean;
  status: string;
  isReady: boolean;
  totalLegs: number;
  allocatedLegCount: number;
  allocatedLegs: AllocatedLeg[];
  outstandingLegs: OutstandingLeg[];
  parties: { proposer: PartyStatus; counterparties: PartyStatus[] };
  outstandingParties: string[];
  canSettle: boolean;
};

type CompositionSummary = {
  id: string;
  tradeName?: string;
  description: string;
  status: string;
  counterparties: string[];
  accepted: string[];
  legs: (OutstandingLeg & { assetCid: string; reference: string; deadline: string })[];
};

type Message = { text: string; type: "success" | "error" | "info"; link?: { href: string; label: string } };

const CLOSED = new Set(["cancelled", "expired", "rejected", "reverted"]);
const PRE_AGREEMENT = new Set(["proposed", "partially_accepted"]);

const STATUS_LABEL: Record<string, string> = {
  proposed: "Awaiting signatures",
  partially_accepted: "Partly signed",
  accepted: "Signed · locking legs",
  allocating: "Locking legs",
  ready_to_settle: "Ready to settle",
  awaiting_governance: "Awaiting BitSafe vote",
  settled: "Settled",
  reverted: "Reverted",
  cancelled: "Cancelled",
  expired: "Expired",
  rejected: "Rejected",
};

function statusLabel(s: string) {
  return STATUS_LABEL[s] ?? s.replaceAll("_", " ");
}

export default function ReadinessPage() {
  const [compositions, setCompositions] = useState<CompositionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const { templates, defaultId } = useTradeTemplates();
  const [newTemplateId, setNewTemplateId] = useState("");

  const fetchCompositions = useCallback(async () => {
    try {
      const res = await api<{ compositions: CompositionSummary[] }>("/compositions");
      const newestFirst = [...res.compositions].reverse();
      setCompositions(newestFirst);
      setSelectedId((cur) => {
        if (cur) return cur;
        const fromUrl =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("id")
            : null;
        if (fromUrl && newestFirst.some((c) => c.id === fromUrl)) return fromUrl;
        return newestFirst[0]?.id ?? "";
      });
      if (newestFirst.length === 0) setLoading(false);
    } catch (err) {
      setMessage({ text: friendlyError((err as Error).message), type: "error" });
      setLoading(false);
    }
  }, []);

  const fetchReadiness = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await api<ReadinessData>(`/compositions/${id}/readiness`);
      setReadiness(data);
    } catch (err) {
      setMessage({ text: `Couldn't load this trade: ${friendlyError((err as Error).message)}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompositions();
  }, [fetchCompositions]);

  useEffect(() => {
    if (!selectedId) return;
    fetchReadiness(selectedId);
    const interval = setInterval(() => {
      fetchReadiness(selectedId);
      fetchCompositions();
    }, 4000);
    return () => clearInterval(interval);
  }, [selectedId, fetchReadiness, fetchCompositions]);

  async function refreshAll() {
    await Promise.all([fetchReadiness(selectedId), fetchCompositions()]);
  }

  async function run(action: () => Promise<Message | void>) {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      const msg = await action();
      if (msg) setMessage(msg);
    } catch (err) {
      setMessage({ text: friendlyError((err as Error).message), type: "error" });
    } finally {
      await refreshAll();
      setBusy(false);
    }
  }

  const handleWithdrawLeg = (legId: string, caller: string) =>
    run(async () => {
      await api(`/compositions/${selectedId}/withdraw-leg`, {
        method: "POST",
        body: JSON.stringify({ legId, caller }),
      });
      return { text: `${roleName(caller)} withdrew the ${legId} leg. It's unlocked again.`, type: "info" };
    });

  const handleSeedNewTrade = () =>
    run(async () => {
      const res = await api<{ id: string; tradeName?: string }>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ templateId: newTemplateId || defaultId }),
      });
      setSelectedId(res.id);
      return {
        text: `New ${res.tradeName ?? "trade"} proposed. Collect signatures, then lock legs.`,
        type: "success",
      };
    });

  const r = readiness;
  const closed = r ? CLOSED.has(r.status) : false;
  const settled = r?.status === "settled";
  const governed = r?.status === "awaiting_governance";
  const agreed = r ? !PRE_AGREEMENT.has(r.status) : false;

  const bannerColor = settled
    ? "#003d3d"
    : closed
      ? "#9b2c2c"
      : r?.isReady
        ? "#2a4e1c"
        : "#e2a03f";

  return (
    <div className="layout-stack" style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 0" }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="badge-chip" style={{ background: "var(--color-sage-glow)", color: "var(--color-deep-forest)" }}>
              Trade readiness
            </span>
            <h1 style={{ fontSize: 28, margin: "8px 0 4px", fontWeight: 600 }}>Is this trade ready to settle?</h1>
            <p style={{ color: "var(--color-lichen-gray)", margin: 0, fontSize: 14 }}>
              Who has signed, which legs are locked, and the next step for each one.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select
              aria-label="Trade to propose"
              className="select"
              value={newTemplateId || defaultId}
              onChange={(e) => setNewTemplateId(e.target.value)}
              style={{ width: "auto", padding: "10px 14px" }}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={handleSeedNewTrade} disabled={busy}>
              + Propose new trade
            </button>
            <Link className="btn primary" href="/demo">
              Settlement desk →
            </Link>
          </div>
        </div>
      </header>

      {compositions.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <label htmlFor="trade-select" style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate)", display: "block", marginBottom: 6 }}>
            Trade
          </label>
          <select
            id="trade-select"
            className="select"
            value={selectedId}
            onChange={(e) => {
              setMessage(null);
              setSelectedId(e.target.value);
            }}
            style={{ width: "100%" }}
          >
            {compositions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.tradeName ?? c.description} · {statusLabel(c.status)} · #{c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      )}

      {message && (
        <div className={`notice ${message.type === "error" ? "error" : message.type}`} role={message.type === "error" ? "alert" : "status"}>
          <p>
            {message.text}{" "}
            {message.link && (
              <Link href={message.link.href} style={{ fontWeight: 600 }}>
                {message.link.label}
              </Link>
            )}
          </p>
          <button className="notice-close" aria-label="Dismiss" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}

      {loading && !r ? (
        <SkeletonBlock rows={5} />
      ) : r ? (
        <div className="layout-stack" style={{ display: "grid", gap: 24 }}>
          {/* Summary */}
          <div className="card" style={{ padding: 24, borderLeft: `6px solid ${bannerColor}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-mist)" }}>
                  {r.tradeName ?? "Trade"}
                </span>
                <h2 style={{ fontSize: 22, margin: "4px 0", fontWeight: 600 }}>
                  {settled
                    ? "✓ Settled atomically"
                    : closed
                      ? `Trade ${statusLabel(r.status).toLowerCase()} — nothing moved`
                      : governed
                        ? "Waiting for BitSafe governors"
                        : r.isReady
                          ? "✓ Ready to settle"
                          : !agreed
                            ? "Waiting for signatures"
                            : "Waiting for legs to be locked"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-lichen-gray)" }}>
                  {settled
                    ? `All ${r.totalLegs} legs delivered · receipt ${r.receiptCid?.slice(0, 18)}…`
                    : closed
                      ? "Every party keeps its original assets."
                      : `${r.allocatedLegCount} of ${r.totalLegs} legs locked · ${statusLabel(r.status)}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {!agreed && !closed && (
                  <Link className="btn" href="/counterparty">
                    Sign on Lender desk →
                  </Link>
                )}
                {agreed && !settled && !closed && !governed && (
                  <Link className="btn primary" href={`/demo?id=${r.compositionId}`}>
                    {r.isReady ? "Settle on Settlement desk →" : "Lock legs on Settlement desk →"}
                  </Link>
                )}
                {governed && (
                  <Link className="btn primary" href={`/governance?id=${r.compositionId}`}>
                    Open BitSafe desk →
                  </Link>
                )}
                {settled && (
                  <Link className="btn primary" href={`/observer?id=${r.compositionId}`}>
                    Auditor proof →
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 16px", fontWeight: 600 }}>1. Signatures</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ padding: 12, background: "var(--color-mint-surface)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-lichen-gray)", textTransform: "uppercase" }}>Proposer</span>
                <div style={{ fontSize: 15, fontWeight: 600, margin: "2px 0" }}>{roleName(r.parties.proposer.party)}</div>
                <span className="chip ok">✓ Proposed</span>
              </div>
              {r.parties.counterparties.map((cp) => (
                <div key={cp.party} style={{ padding: 12, background: "var(--color-parchment)", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-lichen-gray)", textTransform: "uppercase" }}>Counterparty</span>
                  <div style={{ fontSize: 15, fontWeight: 600, margin: "2px 0" }}>{roleName(cp.party)}</div>
                  {cp.accepted ? (
                    <span className="chip ok">✓ Signed</span>
                  ) : closed ? (
                    <span className="chip muted">Did not sign</span>
                  ) : (
                    <Link className="btn sm" href="/counterparty">
                      Awaiting · Lender desk →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Legs */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 16px", fontWeight: 600 }}>2. Legs</h3>
            <div className="table-responsive" style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Leg</th>
                    <th>Asset</th>
                    <th>From → To</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {r.allocatedLegs.map((leg) => (
                    <tr key={leg.legId}>
                      <td style={{ fontWeight: 600 }}>{leg.legId}</td>
                      <td>
                        {formatAmount(leg.amount)} {leg.instrumentId}
                      </td>
                      <td>
                        {leg.provider} → {leg.receiver}
                      </td>
                      <td>
                        {settled ? (
                          <span className="chip done">✓ Settled</span>
                        ) : closed ? (
                          <span className="chip muted">Released</span>
                        ) : (
                          <span className="chip ok">✓ Locked &amp; matched</span>
                        )}
                      </td>
                      <td>
                        {settled ? (
                          <div className="status-cell">
                            <span style={{ fontSize: 12 }}>Delivered to {roleName(leg.receiver)}</span>
                            <Link href={`/observer?id=${r.compositionId}`} style={{ fontSize: 12, fontWeight: 600 }}>
                              View receipt →
                            </Link>
                          </div>
                        ) : closed ? (
                          <span className="muted" style={{ fontSize: 12 }}>
                            Returned to {roleName(leg.provider)}
                          </span>
                        ) : governed ? (
                          <Link href={`/governance?id=${r.compositionId}`} style={{ fontSize: 12 }}>
                            Held for governor vote →
                          </Link>
                        ) : (
                          <button
                            className="sm"
                            onClick={() => handleWithdrawLeg(leg.legId, leg.provider)}
                            disabled={busy}
                          >
                            Withdraw
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {r.outstandingLegs.map((leg) => (
                    <tr key={leg.legId}>
                      <td style={{ fontWeight: 600 }}>{leg.legId}</td>
                      <td>
                        {formatAmount(leg.amount)} {leg.instrumentId}
                      </td>
                      <td>
                        {leg.provider} → {leg.receiver}
                      </td>
                      <td>
                        {closed ? (
                          <span className="chip muted">Released</span>
                        ) : (
                          <span className="chip wait">Not locked</span>
                        )}
                      </td>
                      <td>
                        {closed ? (
                          <span className="muted" style={{ fontSize: 12 }}>
                            Returned to {roleName(leg.provider)}
                          </span>
                        ) : !agreed ? (
                          <span className="muted" style={{ fontSize: 12 }}>Needs all signatures first</span>
                        ) : (
                          <Link className="btn sm" href={`/demo?id=${r.compositionId}`}>
                            Lock on Settlement desk →
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--color-lichen-gray)" }}>
          No trades yet. Click <strong>+ Propose new trade</strong> above, or start on the{" "}
          <Link href="/demo">settlement desk</Link>.
        </div>
      )}
    </div>
  );
}
