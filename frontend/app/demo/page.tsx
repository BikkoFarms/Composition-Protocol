"use client";

/**
 * Settlement desk — settlement only.
 *
 * Trades arrive here after the Exporter proposes and every counterparty signs on
 * the Lender desk. This desk never creates or signs trades. It:
 *   1. shows the signed trades (with who signed and when, as proof),
 *   2. lets each provider lock its leg (field-by-field match against the terms),
 *   3. settles every leg in one atomic transaction, or hands governed trades
 *      to the BitSafe 2-of-3 governors.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatAmount, friendlyError, roleName } from "@/lib/trades";

type LegSpec = {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: string;
  receiver: string;
  assetCid: string;
  reference: string;
  deadline: string;
};

type CommitRecord = {
  updateId: string;
  choice: string;
  actAs: string[];
  at: string;
  detail?: string;
};

type Composition = {
  id: string;
  tradeName?: string;
  description: string;
  status: string;
  proposer: string;
  counterparties: string[];
  accepted: string[];
  legs: LegSpec[];
  allocations: { legId: string }[];
  commits: CommitRecord[];
  receiptCid: string | null;
  requireGovernance?: boolean;
  governanceCid: string | null;
};

type Governance = {
  id: string;
  compositionId: string;
  threshold: number;
  approvals: string[];
  status: string;
};

type Notice = {
  kind: "info" | "success" | "check" | "error";
  title: string;
  text?: string;
  link?: { href: string; label: string };
};

const SETTLEABLE = new Set(["accepted", "allocating", "ready_to_settle"]);
const AWAITING_SIGNATURES = new Set(["proposed", "partially_accepted"]);

function timeOf(iso?: string) {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
}

/** Leg that best demonstrates a mismatch: the cash leg if there is one. */
function pickCheckLeg(c: Composition): LegSpec | undefined {
  return (
    c.legs.find((l) => l.legId === "cash") ??
    c.legs.find((l) => l.instrumentId === "USDCx") ??
    c.legs[1]
  );
}

function signatureOf(c: Composition, party: string) {
  return c.commits.find((x) => x.choice === "AcceptProposal" && x.actAs.includes(party));
}

export default function SettlementDeskPage() {
  const [trades, setTrades] = useState<Composition[]>([]);
  const [governances, setGovernances] = useState<Governance[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ compositions: Composition[]; governances: Governance[] }>("/compositions");
      const newestFirst = [...data.compositions].reverse();
      setTrades(newestFirst);
      setGovernances(data.governances);
      setSelectedId((cur) => {
        if (cur && newestFirst.some((c) => c.id === cur)) return cur;
        const fromUrl =
          typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
        if (fromUrl && newestFirst.some((c) => c.id === fromUrl)) return fromUrl;
        const fromStorage =
          typeof window !== "undefined" ? sessionStorage.getItem("settleflow_selected_trade_id") : null;
        if (fromStorage && newestFirst.some((c) => c.id === fromStorage)) return fromStorage;
        // Priority 1: Trades ready to settle in the active queue
        const ready = newestFirst.find((c) => SETTLEABLE.has(c.status))?.id;
        if (ready) return ready;
        // Priority 2: Governed trades awaiting 2-of-3 votes
        const governed = newestFirst.find((c) => c.status === "awaiting_governance")?.id;
        if (governed) return governed;
        // Priority 3: Fall back to most recent trade (even if settled) so the screen never clears on refresh
        return newestFirst[0]?.id ?? "";
      });
    } catch (e) {
      setNotice({ kind: "error", title: "Can't load trades", text: friendlyError(String((e as Error).message)) });
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const queue = useMemo(() => trades.filter((c) => SETTLEABLE.has(c.status)), [trades]);
  const waiting = useMemo(() => trades.filter((c) => AWAITING_SIGNATURES.has(c.status)), [trades]);
  const withGovernors = useMemo(() => trades.filter((c) => c.status === "awaiting_governance"), [trades]);
  const recent = useMemo(() => trades.filter((c) => c.status === "settled").slice(0, 5), [trades]);

  const trade = trades.find((c) => c.id === selectedId) ?? null;
  const lockedIds = new Set(trade?.allocations.map((a) => a.legId));
  const allLocked = !!trade && trade.legs.every((l) => lockedIds.has(l.legId));
  const checkLeg = trade ? pickCheckLeg(trade) : undefined;
  const gov = trade?.governanceCid ? governances.find((g) => g.id === trade.governanceCid) : undefined;

  function select(id: string) {
    setSelectedId(id);
    setNotice(null);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("settleflow_selected_trade_id", id);
        const url = new URL(window.location.href);
        url.searchParams.set("id", id);
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore
      }
    }
  }

  async function act(key: string, fn: () => Promise<Notice | null>) {
    setBusy(key);
    setNotice(null);
    try {
      setNotice(await fn());
    } catch (e) {
      const raw = String((e as Error).message);
      setNotice(
        /atomic settle reverted/i.test(raw)
          ? { kind: "check", title: "Settlement reverted — nothing moved", text: friendlyError(raw) }
          : { kind: "error", title: "Something went wrong", text: friendlyError(raw) },
      );
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  const lockLeg = (leg: LegSpec) =>
    act(`lock-${leg.legId}`, async () => {
      if (!trade) return null;
      const res = await api<{ composition: Composition }>(`/compositions/${trade.id}/allocate`, {
        method: "POST",
        body: JSON.stringify(leg),
      });
      const left = res.composition.legs.length - res.composition.allocations.length;
      return left === 0
        ? { kind: "success", title: "All legs locked", text: "Every pledge matches the signed terms. Ready to settle." }
        : {
            kind: "info",
            title: `${roleName(leg.provider)} locked ${formatAmount(leg.amount)} ${leg.instrumentId}`,
            text: `${left} leg${left === 1 ? "" : "s"} still to lock.`,
          };
    });

  const tryWrongAmount = (leg: LegSpec) =>
    act(`check-${leg.legId}`, async () => {
      if (!trade) return null;
      const bad = (Number(leg.amount) * 10).toFixed(1);
      try {
        await api(`/compositions/${trade.id}/allocate`, {
          method: "POST",
          body: JSON.stringify({ ...leg, amount: bad }),
        });
      } catch (err) {
        if (String((err as Error).message).includes("allocation match failed")) {
          return {
            kind: "check",
            title: "Wrong amount refused — this leg is still unlocked",
            text: `${roleName(leg.provider)} tried to lock ${formatAmount(bad)} ${leg.instrumentId}, but the signed terms say ${formatAmount(leg.amount)} ${leg.instrumentId}. The ledger refused it. Now lock the correct amount.`,
          };
        }
        throw err;
      }
      throw new Error("A wrong amount was accepted — the matching check did not fire.");
    });

  const settle = () =>
    act("settle", async () => {
      if (!trade) return null;
      const res = await api<Composition>(`/compositions/${trade.id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true, caller: "Operator" }),
      });
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem("settleflow_selected_trade_id", res.id);
          const url = new URL(window.location.href);
          url.searchParams.set("id", res.id);
          window.history.replaceState({}, "", url.toString());
        } catch {
          // ignore
        }
      }
      // Governed trades: the "Waiting for BitSafe governors" panel explains the next step
      if (res.status === "awaiting_governance") return null;
      return {
        kind: "success",
        title: `Settled: ${res.legs.length === 2 ? "both" : `all ${res.legs.length}`} legs moved in one transaction`,
        text: "The auditor received a receipt only — no leg details.",
      };
    });

  const noticeEl = notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <div>
            <p className="notice-title">{notice.title}</p>
            {notice.text && <p>{notice.text}</p>}
            {notice.link && (
              <p style={{ marginTop: 6 }}>
                <Link href={notice.link.href} style={{ fontWeight: 600 }}>
                  {notice.link.label}
                </Link>
              </p>
            )}
          </div>
          <button className="notice-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      );

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Settlement desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Lock legs, then settle</h1>
        <p className="lede">
          Signed trades arrive here once the Exporter has proposed and every
          counterparty has signed on the Lender desk. Each party locks the leg it
          owes. Then every leg settles in one transaction, or none do.
        </p>
      </div>

      <div className="desk-layout">
        {/* Selected trade */}
        <div className="card desk-panel">
          {!trade ? (
            <div>
              {noticeEl}
              <p className="flow-section-title">No trade selected</p>
              {loaded && trades.length === 0 ? (
                <>
                  <p style={{ fontSize: 15, marginTop: 0 }}>
                    No trades on the ledger yet.
                  </p>
                  <ol className="proof-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
                    <li>
                      The <Link href="/proposer">Exporter</Link> proposes a trade.
                    </li>
                    <li>
                      The Lender (and Inspector) sign it on the <Link href="/counterparty">Lender desk</Link>.
                    </li>
                    <li>It then appears here, ready to lock and settle.</li>
                  </ol>
                </>
              ) : (
                <div>
                  <p className="muted" style={{ marginBottom: 12 }}>
                    {queue.length > 0
                      ? "Pick a signed trade from the queue to lock and settle."
                      : "All current trades are settled or awaiting signatures."}
                  </p>
                  {recent.length > 0 && (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Recently settled trades:</p>
                      <div style={{ display: "grid", gap: 6 }}>
                        {recent.map((c) => (
                          <button
                            key={c.id}
                            className="trade-card"
                            onClick={() => select(c.id)}
                          >
                            <span className="trade-name">{c.tradeName ?? "Trade"}</span>
                            <span className="trade-region">#{c.id.slice(0, 8)} · settled ✓</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="deal-card-head" style={{ marginBottom: 4 }}>
                <p className="card-title" style={{ fontSize: 20, margin: 0 }}>
                  {trade.tradeName ?? "Trade"}
                </p>
                <span
                  className={`chip ${
                    trade.status === "settled" ? "done" : allLocked ? "ok" : "wait"
                  }`}
                >
                  {trade.status === "settled"
                    ? "Settled"
                    : trade.status === "awaiting_governance"
                      ? "With BitSafe governors"
                      : AWAITING_SIGNATURES.has(trade.status)
                        ? "Awaiting signatures"
                        : allLocked
                          ? "Ready to settle"
                          : "Locking legs"}
                </span>
              </div>
              <p className="muted mono" style={{ fontSize: 12, marginTop: 0 }}>
                #{trade.id.slice(0, 8)}
                {trade.requireGovernance ? " · BitSafe 2-of-3 required" : ""}
              </p>

              {/* Proof of signatures */}
              <p className="flow-section-title" style={{ marginTop: 16 }}>
                Signatures
              </p>
              <ul className="leg-list">
                <li className="leg-row locked">
                  <div className="leg-main">
                    <strong>{roleName(trade.proposer)}</strong>
                    <span className="leg-sub">Proposed on the Exporter desk</span>
                  </div>
                  <span className="chip ok">
                    ✓ {timeOf(trade.commits.find((x) => x.choice === "Propose")?.at)}
                  </span>
                </li>
                {trade.counterparties.map((p) => {
                  const sig = signatureOf(trade, p);
                  return (
                    <li key={p} className={`leg-row ${sig ? "locked" : ""}`}>
                      <div className="leg-main">
                        <strong>{roleName(p)}</strong>
                        <span className="leg-sub">
                          {sig ? "Signed on the Lender desk" : "Has not signed yet"}
                        </span>
                      </div>
                      {sig ? (
                        <span className="chip ok">✓ {timeOf(sig.at)}</span>
                      ) : (
                        <Link className="btn sm" href="/counterparty">
                          Lender desk →
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Legs */}
              <p className="flow-section-title">
                {trade.status === "settled" ? "Legs delivered" : "Lock each leg"}
              </p>
              <ul className="leg-list">
                {trade.legs.map((leg) => {
                  const locked = lockedIds.has(leg.legId);
                  const canLock = SETTLEABLE.has(trade.status) && !locked;
                  return (
                    <li key={leg.legId} className={`leg-row ${locked ? "locked" : ""}`}>
                      <div className="leg-main">
                        <strong>
                          {formatAmount(leg.amount)} {leg.instrumentId}
                        </strong>
                        <span className="leg-sub">
                          {roleName(leg.provider)} → {roleName(leg.receiver)}
                        </span>
                      </div>
                      <div className="leg-actions">
                        {trade.status === "settled" ? (
                          <span className="chip done">Delivered ✓</span>
                        ) : locked ? (
                          <span className="chip ok">Locked ✓</span>
                        ) : canLock ? (
                          <>
                            {checkLeg?.legId === leg.legId && (
                              <button
                                className="ghost sm"
                                disabled={busy !== null}
                                onClick={() => tryWrongAmount(leg)}
                                aria-label="Try to lock the wrong amount and watch the ledger refuse it"
                              >
                                {busy === `check-${leg.legId}` ? "Checking…" : "Try wrong amount"}
                              </button>
                            )}
                            <button
                              className="primary sm"
                              disabled={busy !== null}
                              onClick={() => lockLeg(leg)}
                            >
                              {busy === `lock-${leg.legId}` ? "Locking…" : `Lock as ${leg.provider}`}
                            </button>
                          </>
                        ) : (
                          <span className="chip muted">Not locked</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {noticeEl}

              {/* Next step */}
              {SETTLEABLE.has(trade.status) && (
                <div className="flow-cta">
                  <button className="primary" disabled={busy !== null || !allLocked} onClick={settle}>
                    {busy === "settle"
                      ? "Settling…"
                      : trade.requireGovernance
                        ? "Send to BitSafe governors"
                        : `Settle ${trade.legs.length === 2 ? "both" : `all ${trade.legs.length}`} legs at once`}
                  </button>
                  {!allLocked && (
                    <span className="muted" style={{ fontSize: 13 }}>
                      Unlocks once every leg is locked.
                    </span>
                  )}
                </div>
              )}
              {trade.status === "awaiting_governance" && (
                <div className="notice info" style={{ marginBottom: 0 }}>
                  <p>
                    Waiting for BitSafe governors: {gov?.approvals.length ?? 0} of {gov?.threshold ?? 2} approvals.
                    Nothing moves until the threshold is met.{" "}
                    <Link href={`/governance?id=${trade.id}`} style={{ fontWeight: 600 }}>
                      Open BitSafe desk →
                    </Link>
                  </p>
                </div>
              )}
              {trade.status === "settled" && (
                <div className="flow-cta">
                  <Link className="btn primary" href={`/observer?id=${trade.id}`}>
                    Auditor proof →
                  </Link>
                  <Link className="btn" href={`/readiness?id=${trade.id}`}>
                    View in Readiness
                  </Link>
                </div>
              )}

              <details className="activity">
                <summary>Ledger history ({trade.commits.length})</summary>
                <ol className="mono">
                  {trade.commits.map((cm) => (
                    <li key={cm.updateId}>
                      {timeOf(cm.at)} · {cm.choice} · {cm.detail}
                    </li>
                  ))}
                </ol>
              </details>
            </>
          )}
        </div>

        {/* Queue */}
        <div className="stack-sm desk-side">
          <div className="card card-lime">
            <h2>Ready to settle ({queue.length})</h2>
            {queue.length === 0 && (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                Nothing signed yet.
              </p>
            )}
            <div style={{ display: "grid", gap: 6 }}>
              {queue.map((c) => (
                <button
                  key={c.id}
                  className={`trade-card ${c.id === selectedId ? "selected" : ""}`}
                  onClick={() => select(c.id)}
                >
                  <span className="trade-name">{c.tradeName ?? "Trade"}</span>
                  <span className="trade-region">
                    #{c.id.slice(0, 8)} · {c.allocations.length}/{c.legs.length} legs locked
                    {c.requireGovernance ? " · BitSafe" : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {withGovernors.length > 0 && (
            <div className="card card-lavender">
              <h2>With BitSafe governors ({withGovernors.length})</h2>
              <div style={{ display: "grid", gap: 6 }}>
                {withGovernors.map((c) => (
                  <button
                    key={c.id}
                    className={`trade-card ${c.id === selectedId ? "selected" : ""}`}
                    onClick={() => select(c.id)}
                  >
                    <span className="trade-name">{c.tradeName ?? "Trade"}</span>
                    <span className="trade-region">#{c.id.slice(0, 8)} · awaiting 2-of-3 vote</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2>Waiting for signatures ({waiting.length})</h2>
            {waiting.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                None. <Link href="/proposer">Propose a trade →</Link>
              </p>
            ) : (
              <ul className="proof-list" style={{ listStyle: "none", paddingLeft: 0 }}>
                {waiting.map((c) => (
                  <li key={c.id} style={{ marginBottom: 6 }}>
                    <strong style={{ color: "var(--color-forest-ink)" }}>{c.tradeName ?? "Trade"}</strong>{" "}
                    <span className="mono" style={{ fontSize: 11 }}>#{c.id.slice(0, 8)}</span>
                    <br />
                    Needs:{" "}
                    {c.counterparties
                      .filter((p) => !c.accepted.includes(p))
                      .map(roleName)
                      .join(", ")}{" "}
                    · <Link href="/counterparty">Lender desk →</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {recent.length > 0 && (
            <div className="card">
              <h2>Recently settled</h2>
              <div style={{ display: "grid", gap: 6 }}>
                {recent.map((c) => (
                  <button
                    key={c.id}
                    className={`trade-card ${c.id === selectedId ? "selected" : ""}`}
                    onClick={() => select(c.id)}
                  >
                    <span className="trade-name">{c.tradeName ?? "Trade"}</span>
                    <span className="trade-region">#{c.id.slice(0, 8)} · settled</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
