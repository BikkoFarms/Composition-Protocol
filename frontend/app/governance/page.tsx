"use client";

/**
 * BitSafe desk — decentralized settlement execution (R-GOV-1/2).
 *
 * Without BitSafe, one Operator key presses "Settle". For trades the Exporter
 * flags as high-value, the settlement agent is instead three independent
 * governors: any 2 must approve before the atomic settle runs, fewer is refused
 * on-ledger, and any one governor can veto.
 *
 * Trades reach this desk through the normal flow:
 *   Exporter proposes (BitSafe required) → Lender/Oracle sign →
 *   Settlement desk locks legs and presses Settle → governors vote here.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";
import { formatAmount, friendlyError, roleName } from "@/lib/trades";

type Composition = {
  id: string;
  tradeName?: string;
  status: string;
  governanceCid: string | null;
  requireGovernance?: boolean;
  legs: { legId: string; instrumentId: string; amount: string; provider: string; receiver: string }[];
};

type Governance = {
  id: string;
  compositionId: string;
  governors: string[];
  threshold: number;
  approvals: string[];
  status: "open" | "executed" | "rejected";
  vetoReason?: string;
};

type Notice = { kind: "info" | "success" | "check" | "error"; title: string; text?: string; link?: { href: string; label: string } };

const GOVERNORS = ["Gov1", "Gov2", "Gov3"] as const;

export default function GovernancePage() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [govs, setGovs] = useState<Governance[]>([]);
  const [selectedGovId, setSelectedGovId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const refresh = useCallback(async () => {
    const data = await api<{ compositions: Composition[]; governances: Governance[] }>("/compositions");
    setComps(data.compositions);
    const newest = [...data.governances].reverse();
    setGovs(newest);
    setSelectedGovId((cur) => {
      if (cur && newest.some((g) => g.id === cur)) return cur;
      const fromUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
      const byTrade = fromUrl ? newest.find((g) => g.compositionId === fromUrl) : undefined;
      return byTrade?.id ?? newest.find((g) => g.status === "open")?.id ?? newest[0]?.id ?? "";
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setNotice({ kind: "error", title: "Can't load governed trades", text: friendlyError(String(e.message ?? e)) });
      setLoading(false);
    });
    const t = setInterval(() => refresh().catch(() => undefined), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const gov = govs.find((g) => g.id === selectedGovId);
  const trade = gov ? comps.find((c) => c.id === gov.compositionId) : undefined;
  const pendingAtDesk = comps.filter(
    (c) => c.requireGovernance && !c.governanceCid && !["settled", "cancelled", "rejected", "reverted", "expired"].includes(c.status),
  );

  async function act(key: string, fn: () => Promise<Notice>) {
    setBusy(key);
    setNotice(null);
    try {
      setNotice(await fn());
    } catch (e) {
      const msg = String((e as Error).message);
      setNotice(
        /below threshold/i.test(msg)
          ? {
              kind: "check",
              title: "Refused — not enough approvals",
              text: `The ledger rejected it: only ${msg.match(/(\d+)\/(\d+)/)?.[1] ?? "too few"} of ${msg.match(/(\d+)\/(\d+)/)?.[2] ?? "the required"} approvals. This is the protection BitSafe adds: one governor (or one compromised key) can't move the money alone. Nothing moved.`,
            }
          : { kind: "error", title: "Something went wrong", text: friendlyError(msg) },
      );
    } finally {
      await refresh();
      setBusy(null);
    }
  }

  const approve = (g: Governance, governor: string) =>
    act(`approve-${governor}`, async () => {
      const res = await api<Governance>(`/compositions/governance/${g.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor }),
      });
      const met = res.approvals.length >= res.threshold;
      return {
        kind: met ? "success" : "info",
        title: `${governor} approved (${res.approvals.length} of ${res.threshold})`,
        text: met ? "Threshold met. Execute to settle every leg atomically." : "One more approval is needed before this trade can settle.",
      };
    });

  const execute = (g: Governance) =>
    act("execute", async () => {
      const res = await api<Composition>(`/compositions/governance/${g.id}/execute`, { method: "POST", body: "{}" });
      return {
        kind: "success",
        title: "Settled by 2-of-3 governors",
        text: `All ${res.legs.length} legs moved in one transaction.`,
      };
    });

  const veto = (g: Governance, governor: string) =>
    act(`veto-${governor}`, async () => {
      await api(`/compositions/governance/${g.id}/veto`, {
        method: "POST",
        body: JSON.stringify({ governor, reason: `Vetoed by ${governor} on the BitSafe desk` }),
      });
      return {
        kind: "check",
        title: `${governor} vetoed the trade`,
        text: "The settlement was stopped. Nothing moved; every party keeps its assets.",
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
          BitSafe · 2-of-3
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">High-value trades need 2 of 3 governors</h1>
        <p className="lede">
          Normally one operator presses Settle. For trades the Exporter marks as
          high-value, settlement also needs 2 of 3 independent governors.
          One approval is not enough, and any governor can veto.
        </p>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card card-mint">
          <h2>What BitSafe adds to the flow</h2>
          <ul className="proof-list">
            <li>
              <strong>No single point of failure.</strong> The operator cannot settle a
              governed trade alone, and cannot forge a governor&apos;s approval: each approval is
              a contract signed by that governor.
            </li>
            <li>
              <strong>Enforced in the Daml contracts.</strong> A governed agreement can
              only settle through the threshold check (R-GOV-1 / R-GOV-2), proven by Daml Script
              tests. This page runs the demo engine, which mirrors those rules.
            </li>
            <li>
              <strong>Veto.</strong> Any named governor can stop a deal before it settles;
              the agreement is archived, so nothing can settle it afterwards.
            </li>
          </ul>
        </div>
        <div className="card card-lime">
          <h2>How a trade gets here</h2>
          <ol className="proof-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
            <li>
              <Link href="/proposer">Exporter</Link> proposes with &ldquo;Require BitSafe 2-of-3&rdquo; ticked.
            </li>
            <li>
              Lender and Inspector sign on the <Link href="/counterparty">Lender desk</Link>.
            </li>
            <li>
              The <Link href="/demo">Settlement desk</Link> locks legs and presses &ldquo;Send to BitSafe governors&rdquo;.
            </li>
            <li>Governors approve here. At 2 of 3, Execute settles every leg at once.</li>
          </ol>
        </div>
      </div>

      {(!gov || loading) && noticeEl}
      {loading ? (
        <SkeletonBlock rows={5} />
      ) : govs.length === 0 ? (
        <div className="card" style={{ padding: 28 }}>
          <p style={{ marginTop: 0, fontWeight: 600 }}>No trades are waiting for governors.</p>
          {pendingAtDesk.length > 0 ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              {pendingAtDesk.length} BitSafe trade{pendingAtDesk.length === 1 ? " is" : "s are"} still being
              signed or locked. <Link href="/demo">Settlement desk →</Link>
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: 0 }}>
              Start one on the <Link href="/proposer">Exporter desk</Link> with &ldquo;Require BitSafe
              2-of-3 approval&rdquo; ticked.
            </p>
          )}
        </div>
      ) : (
        <div className="desk-layout">
          <div className="card desk-panel">
            {gov && (
              <>
                <div className="deal-card-head" style={{ marginBottom: 4 }}>
                  <p className="card-title" style={{ fontSize: 20, margin: 0 }}>
                    {trade?.tradeName ?? "Trade"}
                  </p>
                  <span
                    className={`chip ${gov.status === "executed" ? "done" : gov.status === "rejected" ? "muted" : "wait"}`}
                  >
                    {gov.status === "executed"
                      ? "Settled"
                      : gov.status === "rejected"
                        ? "Vetoed"
                        : `${gov.approvals.length} of ${gov.threshold} approvals`}
                  </span>
                </div>
                <p className="mono muted" style={{ fontSize: 12, marginTop: 0 }}>
                  #{gov.compositionId.slice(0, 8)} · {gov.threshold}-of-{gov.governors.length} governors
                </p>

                {trade && (
                  <ul className="ticket-legs compact" style={{ marginBottom: 16 }}>
                    {trade.legs.map((l) => (
                      <li key={l.legId}>
                        <span>
                          {roleName(l.provider)} → {roleName(l.receiver)}
                        </span>
                        <strong>
                          {formatAmount(l.amount)} {l.instrumentId}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}

                <p className="flow-section-title">Governors</p>
                <ul className="leg-list">
                  {GOVERNORS.map((g) => {
                    const approved = gov.approvals.includes(g);
                    return (
                      <li key={g} className={`leg-row ${approved ? "locked" : ""}`}>
                        <div className="leg-main">
                          <strong>{g}</strong>
                          <span className="leg-sub">Independent operator</span>
                        </div>
                        <div className="leg-actions">
                          {approved ? (
                            <span className="chip ok">Approved ✓</span>
                          ) : gov.status === "open" ? (
                            <>
                              <button className="ghost sm" disabled={busy !== null} onClick={() => veto(gov, g)}>
                                Veto
                              </button>
                              <button className="primary sm" disabled={busy !== null} onClick={() => approve(gov, g)}>
                                {busy === `approve-${g}` ? "Approving…" : `Approve as ${g}`}
                              </button>
                            </>
                          ) : (
                            <span className="chip muted">Did not vote</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {noticeEl}

                {gov.status === "open" && (
                  <div className="flow-cta">
                    <button
                      className={gov.approvals.length >= gov.threshold ? "primary" : ""}
                      disabled={busy !== null}
                      onClick={() => execute(gov)}
                    >
                      {busy === "execute"
                        ? "Executing…"
                        : gov.approvals.length >= gov.threshold
                          ? "Execute settlement"
                          : `Try to execute with ${gov.approvals.length} of ${gov.threshold}`}
                    </button>
                    {gov.approvals.length < gov.threshold && (
                      <span className="muted" style={{ fontSize: 13 }}>
                        Trying early shows it being refused.
                      </span>
                    )}
                  </div>
                )}
                {gov.status === "executed" && (
                  <Link className="btn primary" href={`/observer?id=${gov.compositionId}`}>
                    Auditor proof →
                  </Link>
                )}
                {gov.status === "rejected" && gov.vetoReason && (
                  <p className="muted" style={{ marginBottom: 0 }}>{gov.vetoReason}. Nothing moved.</p>
                )}
              </>
            )}
          </div>

          <div className="stack-sm desk-side">
            <div className="card card-lavender">
              <h2>Governed trades</h2>
              <div style={{ display: "grid", gap: 6 }}>
                {govs.map((g) => {
                  const c = comps.find((x) => x.id === g.compositionId);
                  return (
                    <button
                      key={g.id}
                      className={`trade-card ${g.id === selectedGovId ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedGovId(g.id);
                        setNotice(null);
                      }}
                    >
                      <span className="trade-name">{c?.tradeName ?? "Trade"}</span>
                      <span className="trade-region">
                        #{g.compositionId.slice(0, 8)} ·{" "}
                        {g.status === "executed"
                          ? "settled"
                          : g.status === "rejected"
                            ? "vetoed"
                            : `${g.approvals.length}/${g.threshold} approvals`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
