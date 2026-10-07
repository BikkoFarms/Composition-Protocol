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

  const handleAccept = (party: string) =>
    run(async () => {
      await api(`/compositions/${selectedId}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: party }),
      });
      return { text: `${roleName(party)} confirmed and signed the trade.`, type: "success" };
    });

  const handleAllocateAll = () =>
    run(async () => {
      const detail = await api<CompositionSummary>(`/compositions/${selectedId}`);
      if (PRE_AGREEMENT.has(detail.status)) {
        const unsigned = detail.counterparties.filter((p) => !detail.accepted.includes(p));
        if (unsigned.length > 0) {
          return {
            text: `Cannot lock legs yet: ${unsigned.map(roleName).join(" and ")} must separately confirm the trade first. Use the "Sign as [Party]" buttons below or open the Lender desk.`,
            type: "info",
            link: { href: "/counterparty", label: "Open Lender desk →" },
          };
        }
      }
      try {
        await api(`/compositions/${selectedId}/allocate-all`, { method: "POST" });
      } catch (e) {
        throw new Error((e as Error).message);
      }
      return { text: "All legs locked and matched against the agreed terms.", type: "success" };
    });

  const handleLockLeg = (legId: string) =>
    run(async () => {
      const detail = await api<CompositionSummary>(`/compositions/${selectedId}`);
      if (PRE_AGREEMENT.has(detail.status)) {
        const unsigned = detail.counterparties.filter((p) => !detail.accepted.includes(p));
        if (unsigned.length > 0) {
          return {
            text: `Cannot lock this leg yet: ${unsigned.map(roleName).join(" and ")} have not signed the terms.`,
            type: "info",
            link: { href: "/counterparty", label: "Open Lender desk →" },
          };
        }
      }
      const leg = detail.legs.find((l) => l.legId === legId);
      if (!leg) throw new Error(`leg ${legId} not found`);
      await api(`/compositions/${selectedId}/allocate`, {
        method: "POST",
        body: JSON.stringify(leg),
      });
      return {
        text: `${roleName(leg.provider)} locked ${formatAmount(leg.amount)} ${leg.instrumentId}.`,
        type: "success",
      };
    });

  const handleSettle = () =>
    run(async () => {
      const detail = await api<CompositionSummary>(`/compositions/${selectedId}`);
      if (PRE_AGREEMENT.has(detail.status)) {
        const unsigned = detail.counterparties.filter((p) => !detail.accepted.includes(p));
        if (unsigned.length > 0) {
          return {
            text: `Cannot settle: ${unsigned.map(roleName).join(" and ")} must separately review and confirm the trade before settlement.`,
            type: "error",
            link: { href: "/counterparty", label: "Open Lender desk →" },
          };
        }
      }
      // Allocate legs if not already done
      try {
        await api(`/compositions/${selectedId}/allocate-all`, { method: "POST" });
      } catch {
        // Already allocated or error will surface from settle
      }
      const result = await api<{ status: string; receiptCid?: string | null }>(
        `/compositions/${selectedId}/settle`,
        { method: "POST", body: JSON.stringify({ caller: "Operator" }) },
      );
      if (result.status === "awaiting_governance") {
        return {
          text: "This trade needs a BitSafe 2-of-3 vote before it can settle. Governors sign on the BitSafe desk.",
          type: "info",
          link: { href: "/governance", label: "Open BitSafe desk →" },
        };
      }
      return {
        text: "Settled. Every leg moved in one atomic transaction.",
        type: "success",
        link: { href: "/observer", label: "See auditor proof →" },
      };
    });

  const handleWithdrawLeg = (legId: string, caller: string) =>
    run(async () => {
      await api(`/compositions/${selectedId}/withdraw-leg`, {
        method: "POST",
        body: JSON.stringify({ legId, caller }),
      });
      return { text: `${roleName(caller)} withdrew the ${legId} leg. It's unlocked again.`, type: "info" };
    });

  const handleSeedNewTrade = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ id: string; tradeName?: string }>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ templateId: newTemplateId || defaultId }),
      });
      setSelectedId(res.id);
      await Promise.all([fetchReadiness(res.id), fetchCompositions()]);
      setMessage({
        text: `New ${res.tradeName ?? "trade"} proposed (#${res.id.slice(0, 8)}). Collect signatures, then lock legs and settle.`,
        type: "success",
      });
    } catch (err) {
      setMessage({ text: friendlyError((err as Error).message), type: "error" });
    } finally {
      setBusy(false);
    }
  };

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

        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <label htmlFor="trade-select" style={{ fontSize: 13, fontWeight: 600, color: "var(--color-slate)", display: "block", marginBottom: 6 }}>
            Active Composition
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
                {c.status === "settled" ? "✓ Settled · " : ""}{c.tradeName ?? c.description} · {statusLabel(c.status)} · #{c.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

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
                {!r.isReady && !settled && !closed && !governed && (
                  <>
                    <button className="btn" onClick={handleAllocateAll} disabled={busy || !agreed}>
                      {agreed ? "Lock all legs" : "Awaiting signatures"}
                    </button>
                    {agreed ? (
                      <button
                        className="btn primary"
                        onClick={handleSettle}
                        disabled={busy}
                        title="Lock all legs and settle atomically in one transaction"
                      >
                        Settle all legs →
                      </button>
                    ) : (
                      <Link
                        className="btn primary"
                        href="/counterparty"
                        title="Lender and Oracle must review and confirm on the Lender desk"
                      >
                        Review on Lender desk →
                      </Link>
                    )}
                  </>
                )}
                {r.canSettle && !governed && (
                  <button className="btn primary" onClick={handleSettle} disabled={busy}>
                    Settle now →
                  </button>
                )}
                {governed && (
                  <Link className="btn primary" href="/governance">
                    Open BitSafe desk →
                  </Link>
                )}
                {settled && (
                  <Link className="btn primary" href="/observer">
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
                    <button className="primary sm" disabled={busy} onClick={() => handleAccept(cp.party)}>
                      Sign as {cp.party}
                    </button>
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
                    <th>Instrument</th>
                    <th>Amount</th>
                    <th>Provider → Receiver</th>
                    <th>Allocation Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {r.allocatedLegs.map((leg) => (
                    <tr key={leg.legId}>
                      <td style={{ fontWeight: 600 }}>{leg.legId}</td>
                      <td>{leg.instrumentId}</td>
                      <td>{formatAmount(leg.amount)}</td>
                      <td>
                        {leg.provider} → {leg.receiver}
                      </td>
                      <td>
                        {settled ? (
                          <span className="chip done">✓ Settled atomically</span>
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
                            <Link href="/observer" style={{ fontSize: 12, fontWeight: 600 }}>
                              View receipt →
                            </Link>
                          </div>
                        ) : closed ? (
                          <span className="muted" style={{ fontSize: 12 }}>
                            Returned to {roleName(leg.provider)}
                          </span>
                        ) : governed ? (
                          <span className="muted" style={{ fontSize: 12 }}>Held for governor vote</span>
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
                      <td>{leg.instrumentId}</td>
                      <td>{formatAmount(leg.amount)}</td>
                      <td>
                        {leg.provider} → {leg.receiver}
                      </td>
                      <td>
                        {closed ? (
                          <span className="chip muted">Released</span>
                        ) : (
                          <span className="chip wait">Unallocated</span>
                        )}
                      </td>
                      <td>
                        {closed ? (
                          <span className="muted" style={{ fontSize: 12 }}>
                            Returned to {roleName(leg.provider)}
                          </span>
                        ) : !agreed ? (
                          <button
                            className="primary sm"
                            onClick={() => {
                              handleAccept(leg.provider);
                              setTimeout(() => handleLockLeg(leg.legId), 300);
                            }}
                            disabled={busy}
                            title="Sign as provider and lock leg"
                          >
                            Sign &amp; Lock as {leg.provider}
                          </button>
                        ) : (
                          <button
                            className="primary sm"
                            onClick={() => handleLockLeg(leg.legId)}
                            disabled={busy}
                          >
                            Lock as {leg.provider}
                          </button>
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
