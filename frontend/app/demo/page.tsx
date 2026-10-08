"use client";

/**
 * Settlement desk — guided flow:
 *   1. Choose a trade from the catalogue
 *   2. Propose + collect every counterparty signature
 *   3. Lock each leg (allocation matched field-by-field against the agreed terms)
 *   4. Settle every leg in one atomic transaction, then prove auditor privacy
 * Every step calls the live API; nothing is simulated with timers.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  formatAmount,
  friendlyError,
  roleName,
  useTradeTemplates,
  type TradeTemplate,
} from "@/lib/trades";

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

type Allocation = {
  allocationCid: string;
  updateId: string;
  legId: string;
};

type CommitRecord = {
  updateId: string;
  contractId: string;
  choice: string;
  actAs: string[];
  at: string;
  detail?: string;
};

type Composition = {
  id: string;
  tradeName?: string;
  templateId?: string;
  agreementCid: string | null;
  receiptCid: string | null;
  status: string;
  description: string;
  counterparties: string[];
  accepted: string[];
  legs: LegSpec[];
  allocations: Allocation[];
  commits: CommitRecord[];
};

type MoneyShot = {
  participant: { visibleTokens: unknown[]; settlementReceipts: unknown[] };
  observer: { visibleTokens: unknown[]; settlementReceipts: unknown[] };
};

type Notice = {
  kind: "info" | "success" | "check" | "error";
  title: string;
  text?: string;
};

const STEPS = [
  { title: "Choose trade", hint: "Pick what you're settling" },
  { title: "Agree terms", hint: "All parties sign" },
  { title: "Lock legs", hint: "Each pledge is checked" },
  { title: "Settle", hint: "Everything moves at once" },
];

/** A deliberately wrong amount for the safety-check demo. */
function wrongAmount(amount: string): string {
  return (Number(amount) * 10).toFixed(1);
}

/** Leg that best demonstrates a mismatch: the cash leg if there is one. */
function pickCheckLeg(c: Composition): LegSpec | undefined {
  return (
    c.legs.find((l) => l.legId === "cash") ??
    c.legs.find((l) => l.instrumentId === "USDCx") ??
    c.legs[1] ??
    c.legs[0]
  );
}

export default function DemoPage() {
  const { templates, defaultId, error: catalogError } = useTradeTemplates();
  const [templateId, setTemplateId] = useState<string>("");
  const [composition, setComposition] = useState<Composition | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [moneyShot, setMoneyShot] = useState<MoneyShot | null>(null);
  const [loadStats, setLoadStats] = useState<{
    ran: number;
    metrics: { compositionsSettled: number };
  } | null>(null);

  useEffect(() => {
    if (!templateId && defaultId) setTemplateId(defaultId);
  }, [defaultId, templateId]);

  const template: TradeTemplate | undefined = useMemo(
    () => templates.find((t) => t.id === templateId),
    [templates, templateId],
  );

  const lockedIds = new Set(composition?.allocations.map((a) => a.legId));
  const allLocked =
    !!composition && composition.legs.every((l) => lockedIds.has(l.legId));
  const signed =
    !!composition &&
    composition.counterparties.every((p) => composition.accepted.includes(p));
  const settled = composition?.status === "settled";

  const stepDone = [!!composition, signed, allLocked, settled];
  const activeStep = stepDone.findIndex((d) => !d);

  function fail(e: unknown) {
    setNotice({
      kind: "error",
      title: "Something went wrong",
      text: friendlyError(String((e as Error).message ?? e)),
    });
  }

  async function createTrade(id = templateId): Promise<Composition> {
    const data = await api<{ composition: Composition }>(
      "/compositions/demo/open-desk",
      { method: "POST", body: JSON.stringify({ templateId: id }) },
    );
    setComposition(data.composition);
    setMoneyShot(null);
    return data.composition;
  }

  async function onCreate() {
    setBusy("create");
    setNotice(null);
    try {
      const c = await createTrade();
      setNotice({
        kind: "info",
        title: "Trade agreed",
        text: `${c.counterparties.map(roleName).join(" and ")} signed the terms. Now lock each leg.`,
      });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function onLock(leg: LegSpec) {
    if (!composition) return;
    setBusy(`lock-${leg.legId}`);
    setNotice(null);
    try {
      const data = await api<{ composition: Composition }>(
        `/compositions/${composition.id}/allocate`,
        { method: "POST", body: JSON.stringify(leg) },
      );
      setComposition(data.composition);
      const remaining = data.composition.legs.length - data.composition.allocations.length;
      setNotice(
        remaining === 0
          ? { kind: "success", title: "All legs locked", text: "Every pledge matches the agreed terms. You can settle now." }
          : { kind: "info", title: `${roleName(leg.provider)} locked ${formatAmount(leg.amount)} ${leg.instrumentId}`, text: `${remaining} leg${remaining === 1 ? "" : "s"} left to lock.` },
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function runWrongAmountCheck(c: Composition, leg: LegSpec): Promise<Notice> {
    const bad = wrongAmount(leg.amount);
    try {
      await api(`/compositions/${c.id}/allocate`, {
        method: "POST",
        body: JSON.stringify({ ...leg, amount: bad }),
      });
    } catch (err) {
      const msg = String((err as Error).message);
      if (msg.includes("allocation match failed")) {
        return {
          kind: "check",
          title: "Safety check passed — wrong amount refused",
          text: `${roleName(leg.provider)} tried to lock ${formatAmount(bad)} ${leg.instrumentId}, but the trade says ${formatAmount(leg.amount)} ${leg.instrumentId}. The ledger refused it and nothing changed.`,
        };
      }
      throw err;
    }
    throw new Error("A wrong amount was accepted — the matching check did not fire.");
  }

  async function onWrongAmount(leg: LegSpec) {
    if (!composition) return;
    setBusy(`check-${leg.legId}`);
    setNotice(null);
    try {
      setNotice(await runWrongAmountCheck(composition, leg));
      setComposition(await api<Composition>(`/compositions/${composition.id}`));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function onLockAll() {
    if (!composition) return;
    setBusy("lock-all");
    setNotice(null);
    try {
      const data = await api<{ composition: Composition }>(
        `/compositions/${composition.id}/allocate-all`,
        { method: "POST" },
      );
      setComposition(data.composition);
      setNotice({ kind: "success", title: "All legs locked", text: "Every pledge matches the agreed terms. You can settle now." });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function settle(c: Composition) {
    const done = await api<Composition>(`/compositions/${c.id}/settle`, {
      method: "POST",
      body: JSON.stringify({ withRegulator: true, caller: "Operator" }),
    });
    setComposition(done);
    const shot = await api<MoneyShot>("/audit/money-shot");
    setMoneyShot(shot);
    return done;
  }

  async function onSettle() {
    if (!composition) return;
    setBusy("settle");
    setNotice(null);
    try {
      await settle(composition);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function onLockAndSettle() {
    if (!composition) return;
    setBusy("settle");
    setNotice(null);
    try {
      if (!allLocked) {
        const lockedData = await api<{ composition: Composition }>(
          `/compositions/${composition.id}/allocate-all`,
          { method: "POST" },
        );
        await settle(lockedData.composition);
      } else {
        await settle(composition);
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  /** Run the whole flow (incl. the wrong-amount check) for the selected trade. */
  async function onAutoRun() {
    setBusy("auto");
    setNotice(null);
    try {
      let c: Composition = await createTrade();
      const checkLeg = pickCheckLeg(c);
      let check: Notice | null = null;
      for (const leg of c.legs) {
        if (checkLeg && leg.legId === checkLeg.legId) {
          check = await runWrongAmountCheck(c, leg);
        }
        const data = await api<{ composition: Composition }>(
          `/compositions/${c.id}/allocate`,
          { method: "POST", body: JSON.stringify(leg) },
        );
        c = data.composition;
        setComposition(c);
      }
      await settle(c);
      if (check) setNotice(check);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  function onReset() {
    setComposition(null);
    setMoneyShot(null);
    setNotice(null);
  }

  async function runBatch() {
    setBusy("batch");
    setNotice(null);
    try {
      const data = await api<{ ran: number; metrics: { compositionsSettled: number } }>(
        "/compositions/demo/load",
        { method: "POST", body: JSON.stringify({ count: 50, templateId }) },
      );
      setLoadStats(data);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  const isBusy = busy !== null;
  const checkLeg = composition ? pickCheckLeg(composition) : undefined;

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Settlement desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Settle a trade in four steps</h1>
        <p className="lede">
          Pick a trade, have every party sign, then lock each leg. Each pledge
          is checked against the agreed terms (parties, instrument, amount,
          reference and asset). Nothing moves until every leg is locked. Then
          all legs settle together in one transaction.
        </p>
      </div>

      <ol className="flow-steps" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className={stepDone[i] ? "done" : i === activeStep ? "active" : ""}
            aria-current={i === activeStep ? "step" : undefined}
          >
            <span className="n">{stepDone[i] ? "✓" : i + 1}</span>
            <span style={{ minWidth: 0 }}>
              <strong>{s.title}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {s.hint}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {notice && (
        <div className={`notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}>
          <div>
            <p className="notice-title">{notice.title}</p>
            {notice.text && <p>{notice.text}</p>}
          </div>
          <button className="notice-close" aria-label="Dismiss" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      <div className="desk-layout">
        <div className="card desk-panel">
          {/* Step 1 — choose */}
          {!composition && (
            <>
              <p className="flow-section-title">1 · Choose a trade</p>
              {catalogError && (
                <div className="notice error" role="alert">
                  <p>{catalogError}</p>
                </div>
              )}
              <div className="trade-grid" role="radiogroup" aria-label="Trade type">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    role="radio"
                    aria-checked={t.id === templateId}
                    className={`trade-card ${t.id === templateId ? "selected" : ""}`}
                    onClick={() => setTemplateId(t.id)}
                    disabled={isBusy}
                  >
                    <span className="trade-name">{t.name}</span>
                    <span className="trade-region">
                      {t.region} · {t.legs.length} legs
                    </span>
                    <span className="trade-legs">
                      {t.legs.map((l) => (
                        <span key={l.legId} className="chip">
                          {l.instrumentId}
                        </span>
                      ))}
                    </span>
                  </button>
                ))}
              </div>
              {template && (
                <p className="muted" style={{ fontSize: 14, marginTop: 0 }}>
                  {template.summary}
                </p>
              )}
              <div className="flow-cta">
                <button className="primary" disabled={isBusy || !template} onClick={onCreate}>
                  {busy === "create" ? "Creating…" : "Create trade & collect signatures"}
                </button>
                <button disabled={isBusy || !template} onClick={onAutoRun} title="Runs full allocation matching flow: Propose → Accept → Try wrong amount (refused) → Lock all legs → Settle atomically">
                  {busy === "auto" ? "Running…" : "Run allocation matching demo"}
                </button>
              </div>
            </>
          )}

          {/* Steps 2–4 — the live trade */}
          {composition && (
            <>
              <div className="deal-card-head" style={{ marginBottom: 6 }}>
                <p className="card-title" style={{ fontSize: 20, margin: 0 }}>
                  {composition.tradeName ?? "Trade"}
                </p>
                <span className={`chip ${settled ? "done" : allLocked ? "ok" : "wait"}`}>
                  {settled ? "Settled" : allLocked ? "Ready to settle" : "Locking legs"}
                </span>
              </div>
              <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                Signed by {roleName("Alice")}
                {composition.accepted.map((p) => `, ${roleName(p)}`).join("")} ·{" "}
                <span className="mono">#{composition.id.slice(0, 8)}</span>
              </p>

              <p className="flow-section-title" style={{ marginTop: 16 }}>
                {settled ? "Legs delivered" : "3 · Lock each leg"}
              </p>
              <ul className="leg-list">
                {composition.legs.map((leg) => {
                  const locked = lockedIds.has(leg.legId);
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
                        {settled ? (
                          <span className="chip done">Delivered ✓</span>
                        ) : locked ? (
                          <span className="chip ok">Locked ✓</span>
                        ) : (
                          <>
                            {checkLeg?.legId === leg.legId && (
                              <button
                                className="ghost sm"
                                disabled={isBusy}
                                onClick={() => onWrongAmount(leg)}
                                title="Try to lock the wrong amount and watch the ledger refuse it"
                              >
                                {busy === `check-${leg.legId}` ? "Checking…" : "Try wrong amount"}
                              </button>
                            )}
                            <button
                              className="primary sm"
                              disabled={isBusy}
                              onClick={() => onLock(leg)}
                            >
                              {busy === `lock-${leg.legId}` ? "Locking…" : `Lock as ${leg.provider}`}
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {!settled && (
                <>
                  <p className="flow-section-title">4 · Settle</p>
                  <div className="flow-cta">
                    <button className="primary" disabled={isBusy} onClick={onLockAndSettle}>
                      {busy === "settle"
                        ? "Settling…"
                        : allLocked
                          ? (composition.legs.length === 2 ? "Settle both legs at once" : `Settle all ${composition.legs.length} legs at once`)
                          : "Lock all legs & settle atomically"}
                    </button>
                    {!allLocked && (
                      <button disabled={isBusy} onClick={onLockAll}>
                        {busy === "lock-all" ? "Locking…" : "Lock remaining legs"}
                      </button>
                    )}
                    <button className="ghost" disabled={isBusy} onClick={onReset}>
                      Start over
                    </button>
                  </div>
                  {!allLocked && (
                    <p className="muted" style={{ fontSize: 13, marginBottom: 0 }}>
                      Settle unlocks once all {composition.legs.length} legs are locked.
                    </p>
                  )}
                </>
              )}

              {settled && (
                <div className="notice success" style={{ display: "block", marginBottom: 0 }}>
                  <p className="notice-title">
                    Settled: {composition.legs.length === 2 ? "both" : `all ${composition.legs.length}`} legs moved in one transaction
                  </p>
                  <div className="result-grid">
                    <div>
                      <span className="k">Receipt</span>
                      <span className="v mono">{composition.receiptCid?.slice(0, 18)}…</span>
                    </div>
                    <div>
                      <span className="k">Lender can see</span>
                      <span className="v">
                        {moneyShot ? `${moneyShot.participant.visibleTokens.length} tokens` : "its own legs"}
                      </span>
                    </div>
                    <div>
                      <span className="k">Auditor can see</span>
                      <span className="v">
                        {moneyShot
                          ? `${moneyShot.observer.visibleTokens.length} tokens · receipt only`
                          : "receipt only"}
                      </span>
                    </div>
                  </div>
                  <div className="flow-cta">
                    <button className="primary" onClick={onReset}>
                      Settle another trade
                    </button>
                    <Link className="btn primary" href="/observer">
                      Prove money shot (Auditor) →
                    </Link>
                    <Link className="btn" href={`/readiness?id=${composition.id}`}>
                      View in Readiness
                    </Link>
                  </div>
                </div>
              )}

              {composition.commits.length > 0 && (
                <details className="activity">
                  <summary>Ledger activity ({composition.commits.length} commits)</summary>
                  <ol className="mono">
                    {composition.commits.map((cm) => (
                      <li key={cm.updateId}>
                        {cm.choice} · {cm.detail ?? cm.contractId}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </>
          )}
        </div>

        <div className="stack-sm desk-side">
          <div className="card card-lime">
            <h2>What happens</h2>
            <ol className="proof-list" style={{ listStyle: "decimal", paddingLeft: 20 }}>
              <li>Exporter proposes; lender (and inspector) sign.</li>
              <li>Each party locks the leg it owes.</li>
              <li>A pledge that doesn&apos;t match the terms is refused.</li>
              <li>Settle moves every leg together, or none at all.</li>
              <li>The auditor gets a receipt and never sees the legs.</li>
            </ol>
          </div>
          <div className="card card-mint adopt-panel">
            <h2>Why builders adopt this</h2>
            <div className="loc-compare" aria-label="Lines of code comparison">
              <div>
                <span className="loc-label">With SettleFlow</span>
                <strong className="loc-n">~99</strong>
                <span className="loc-unit">LOC</span>
              </div>
              <div className="loc-vs">vs</div>
              <div>
                <span className="loc-label">Hand-rolled</span>
                <strong className="loc-n loc-n-warn">~192</strong>
                <span className="loc-unit">LOC</span>
              </div>
            </div>
            <p className="card-body" style={{ marginBottom: 0, fontSize: 13 }}>
              Same multi-party DvP, ~2× less Daml. Measured in{" "}
              <code style={{ fontSize: 12 }}>docs/SIDE_BY_SIDE.md</code>.
            </p>
          </div>
          <div className="card card-lavender">
            <h2>Load test</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Settle 50 &times; {template?.name ?? "trade"} back to back.
            </p>
            <button disabled={isBusy} onClick={runBatch}>
              {busy === "batch" ? "Settling…" : "Settle 50 trades"}
            </button>
            {loadStats && (
              <p className="mono" style={{ marginTop: 12, marginBottom: 0 }}>
                {loadStats.ran} ran · {loadStats.metrics.compositionsSettled} settled in total
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
