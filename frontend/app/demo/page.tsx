"use client";

/**
 * Settlement desk — centerpiece: Propose → Allocate (match) → mismatch reject → Settle.
 * Steps call live API; phases track real composition status / commits (no cosmetic timers).
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type PartyId = "Operator" | "Alice" | "Bob" | "Oracle" | "Regulator";

type LegSpec = {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: PartyId;
  receiver: PartyId;
  assetCid: string;
  reference: string;
  deadline: string;
};

type Allocation = {
  allocationCid: string;
  updateId: string;
  legId: string;
  matchedFields: string[];
};

type CommitRecord = {
  updateId: string;
  contractId: string;
  choice: string;
  actAs: PartyId[];
  at: string;
  detail?: string;
};

type Composition = {
  id: string;
  proposalCid: string;
  agreementCid: string | null;
  receiptCid: string | null;
  status: string;
  description: string;
  legs: LegSpec[];
  allocations: Allocation[];
  commits: CommitRecord[];
  legSummaries?: { legId: string; instrumentId: string; status: string }[];
};

type MoneyShot = {
  participant: { visibleTokens: unknown[]; settlementReceipts: unknown[] };
  observer: {
    visibleTokens: unknown[];
    settlementReceipts: unknown[];
    privacy: { claim: string };
  };
};

type StepId =
  | "idle"
  | "proposed"
  | "allocating"
  | "mismatch"
  | "ready"
  | "settled"
  | "reverted";

const PHASES: { id: StepId; label: string; hint: string }[] = [
  { id: "proposed", label: "Proposed", hint: "Agreement formed after accept" },
  {
    id: "allocating",
    label: "Allocating",
    hint: "Each leg matched to trade terms",
  },
  {
    id: "mismatch",
    label: "Mismatch reject",
    hint: "Wrong amount rejected — trade stays not ready",
  },
  { id: "ready", label: "All ready", hint: "Every allocation matched" },
  { id: "settled", label: "Settled", hint: "Receipt + prove privacy" },
];

function phaseActive(current: StepId, target: StepId): boolean {
  const order: StepId[] = [
    "idle",
    "proposed",
    "allocating",
    "mismatch",
    "ready",
    "settled",
  ];
  return order.indexOf(current) >= order.indexOf(target);
}

export default function DemoPage() {
  const [composition, setComposition] = useState<Composition | null>(null);
  const [step, setStep] = useState<StepId>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatchReason, setMismatchReason] = useState<string | null>(null);
  const [moneyShot, setMoneyShot] = useState<MoneyShot | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [loadStats, setLoadStats] = useState<{
    ran: number;
    metrics: { compositionsSettled: number; legsSettled: number };
  } | null>(null);

  const pushLog = useCallback((line: string) => {
    setLog((prev) => [...prev, line]);
  }, []);

  async function openDesk() {
    setBusy(true);
    setError(null);
    setMismatchReason(null);
    setMoneyShot(null);
    setLog([]);
    setComposition(null);
    try {
      const data = await api<{
        composition: Composition;
        commits: CommitRecord[];
      }>("/compositions/demo/open-desk", { method: "POST", body: "{}" });
      setComposition(data.composition);
      setStep("proposed");
      const last = data.composition.commits.at(-1);
      pushLog(
        `Propose+Accept → agreement ${data.composition.agreementCid} · updateId ${last?.updateId ?? "—"}`,
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function allocateLeg(leg: LegSpec, override?: Partial<LegSpec>) {
    if (!composition) return null;
    const payload = { ...leg, ...override };
    try {
      const data = await api<{
        composition: Composition;
        allocation: Allocation;
        commit: CommitRecord;
      }>(`/compositions/${composition.id}/allocate`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setComposition(data.composition);
      pushLog(
        `AllocateLeg ${leg.legId} MATCHED · cid ${data.allocation.allocationCid} · updateId ${data.commit.updateId}`,
      );
      pushLog(`  fields: ${data.allocation.matchedFields.join(", ")}`);
      if (data.composition.status === "ready_to_settle") {
        setStep("ready");
      } else {
        setStep("allocating");
      }
      return data;
    } catch (e) {
      const msg = String((e as Error).message);
      throw Object.assign(new Error(msg), { rejectMessage: msg });
    }
  }

  /** Default judge path: allocate, deliberate mismatch, correct, settle. */
  async function runAllocationCenterpiece() {
    setBusy(true);
    setError(null);
    setMismatchReason(null);
    setMoneyShot(null);
    setLog([]);
    try {
      const opened = await api<{ composition: Composition }>(
        "/compositions/demo/open-desk",
        { method: "POST", body: "{}" },
      );
      let c = opened.composition;
      setComposition(c);
      setStep("proposed");
      pushLog(
        `1. Proposed · proposalCid ${c.proposalCid} · agreementCid ${c.agreementCid}`,
      );
      const lastOpen = c.commits.at(-1);
      pushLog(`   updateId ${lastOpen?.updateId} · ${lastOpen?.choice}`);

      setStep("allocating");
      // Leg 1 — Alice CBTC correct
      const legA = c.legs.find((l) => l.legId === "collateral")!;
      const a1 = await api<{
        composition: Composition;
        allocation: Allocation;
        commit: CommitRecord;
      }>(`/compositions/${c.id}/allocate`, {
        method: "POST",
        body: JSON.stringify(legA),
      });
      c = a1.composition;
      setComposition(c);
      pushLog(
        `2. Alice allocated CBTC · MATCHED · ${a1.allocation.allocationCid} · ${a1.commit.updateId}`,
      );

      // Leg 2 — deliberate wrong amount (headline reject)
      const legB = c.legs.find((l) => l.legId === "cash")!;
      setStep("mismatch");
      let rejectMsg = "";
      try {
        await api(`/compositions/${c.id}/allocate`, {
          method: "POST",
          body: JSON.stringify({
            ...legB,
            amount: "999999.0", // wrong vs agreed trade terms
          }),
        });
      } catch (err) {
        rejectMsg = String((err as Error).message);
      }
      if (!rejectMsg) {
        throw new Error("expected mismatch rejection did not fire");
      }
      setMismatchReason(rejectMsg);
      pushLog(`3. MISMATCH REJECT (wrong amount on cash) — trade NOT ready`);
      pushLog(`   ${rejectMsg}`);
      // Refresh composition — must be unchanged (still one allocation)
      const mid = await api<Composition>(`/compositions/${c.id}`);
      c = mid;
      setComposition(c);
      if (c.allocations.length !== 1) {
        throw new Error("half-state: allocation count changed after reject");
      }

      // Correct cash allocation
      const a2 = await api<{
        composition: Composition;
        allocation: Allocation;
        commit: CommitRecord;
      }>(`/compositions/${c.id}/allocate`, {
        method: "POST",
        body: JSON.stringify(legB),
      });
      c = a2.composition;
      setComposition(c);
      setStep("allocating");
      pushLog(
        `4. Bob allocated USDCx · MATCHED · ${a2.commit.updateId}`,
      );

      // Leg 3 — Oracle cETH
      const legC = c.legs.find((l) => l.legId === "sponsor")!;
      const a3 = await api<{
        composition: Composition;
        allocation: Allocation;
        commit: CommitRecord;
      }>(`/compositions/${c.id}/allocate`, {
        method: "POST",
        body: JSON.stringify(legC),
      });
      c = a3.composition;
      setComposition(c);
      setStep("ready");
      pushLog(
        `5. Oracle allocated cETH · MATCHED · all-ready · ${a3.commit.updateId}`,
      );

      // Settle
      const settled = await api<Composition>(`/compositions/${c.id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true }),
      });
      setComposition(settled);
      setStep("settled");
      const settleCommit = settled.commits.at(-1);
      pushLog(
        `6. Settle · receipt ${settled.receiptCid} · updateId ${settleCommit?.updateId}`,
      );

      const shot = await api<{
        participant: MoneyShot["participant"];
        observer: MoneyShot["observer"];
      }>("/audit/money-shot");
      setMoneyShot({
        participant: shot.participant,
        observer: shot.observer,
      });
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function submitMismatchOnly() {
    if (!composition) {
      setError("Open the desk first (or run the centerpiece flow).");
      return;
    }
    const legB = composition.legs.find((l) => l.legId === "cash");
    if (!legB) return;
    if (composition.allocations.some((a) => a.legId === "cash")) {
      setError("Cash leg already allocated — open a new desk to retry mismatch.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // Ensure collateral allocated so we are in allocating state
      if (!composition.allocations.some((a) => a.legId === "collateral")) {
        const legA = composition.legs.find((l) => l.legId === "collateral")!;
        await allocateLeg(legA);
      }
      setStep("mismatch");
      await allocateLeg(legB, { amount: "999999.0" });
      setError("Expected rejection did not occur");
    } catch (e) {
      const msg = String((e as Error).message);
      setMismatchReason(msg);
      pushLog(`MISMATCH REJECT: ${msg}`);
      const refreshed = await api<Composition>(
        `/compositions/${composition.id}`,
      );
      setComposition(refreshed);
    } finally {
      setBusy(false);
    }
  }

  async function oneClickSettle() {
    setBusy(true);
    setError(null);
    setMismatchReason(null);
    setLog([]);
    try {
      const data = await api<{
        composition: Composition;
        error: string | null;
        moneyShot: MoneyShot;
      }>("/compositions/demo/run-full", {
        method: "POST",
        body: JSON.stringify({ forceFail: false }),
      });
      setComposition(data.composition);
      if (data.error) {
        setError(data.error);
        setStep("reverted");
      } else {
        setStep("settled");
        setMoneyShot(data.moneyShot);
        pushLog(
          `One-click: allocate-all + settle · receipt ${data.composition.receiptCid}`,
        );
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function runBatch() {
    setBusy(true);
    try {
      const data = await api<{
        ran: number;
        metrics: { compositionsSettled: number; legsSettled: number };
      }>("/compositions/demo/load", {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      setLoadStats(data);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const observerEmpty =
    moneyShot &&
    Array.isArray(moneyShot.observer.visibleTokens) &&
    moneyShot.observer.visibleTokens.length === 0;

  const allocatedIds = new Set(composition?.allocations.map((a) => a.legId));

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Settlement desk · Allocation matching
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Allocate, match, then settle</h1>
        <p className="lede">
          Headline claim on camera: each allocation is checked against the trade
          (parties, amount, instrument, reference, deadline). A wrong amount is
          rejected — the deal stays not ready — then correct pledges unlock Settle.
        </p>
      </div>

      <div className="desk-layout">
        <div className="card desk-panel">
          <h2>Workflow specimen</h2>
          <p className="card-title" style={{ fontSize: 22, marginBottom: 4 }}>
            3-party DvP · CBTC + USDCx + cETH
          </p>
          <p className="muted" style={{ marginBottom: 16, fontSize: 14 }}>
            Status:{" "}
            <strong>{composition?.status ?? "idle"}</strong>
            {composition?.agreementCid
              ? ` · agreement ${composition.agreementCid}`
              : ""}
          </p>

          <ul className="ticket-legs">
            {(composition?.legs ?? [
              {
                legId: "collateral",
                instrumentId: "CBTC",
                amount: "2.0",
                provider: "Alice" as PartyId,
                receiver: "Bob" as PartyId,
                assetCid: "—",
                reference: "tf-collateral",
                deadline: "—",
              },
              {
                legId: "cash",
                instrumentId: "USDCx",
                amount: "10000.0",
                provider: "Bob" as PartyId,
                receiver: "Alice" as PartyId,
                assetCid: "—",
                reference: "tf-cash",
                deadline: "—",
              },
              {
                legId: "sponsor",
                instrumentId: "cETH",
                amount: "1.5",
                provider: "Oracle" as PartyId,
                receiver: "Bob" as PartyId,
                assetCid: "—",
                reference: "tf-sponsor",
                deadline: "—",
              },
            ]).map((leg) => (
              <li key={leg.legId}>
                <span>
                  {leg.legId} · {leg.instrumentId} · ref {leg.reference}
                  {allocatedIds.has(leg.legId) ? " · allocated ✓" : ""}
                </span>
                <strong>
                  {leg.amount} · {leg.provider}→{leg.receiver}
                </strong>
              </li>
            ))}
          </ul>

          <div className="phase-rail" role="list">
            {PHASES.map((p) => (
              <div
                key={p.id}
                role="listitem"
                className={`phase-chip ${
                  phaseActive(step, p.id) && step !== p.id ? "done" : ""
                } ${step === p.id ? "active" : ""} ${
                  p.id === "mismatch" && mismatchReason ? "fail" : ""
                }`}
              >
                <span className="phase-n">
                  {PHASES.findIndex((x) => x.id === p.id) + 1}
                </span>
                <div>
                  <strong>{p.label}</strong>
                  <span>{p.hint}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="row" style={{ marginBottom: 0, marginTop: 8 }}>
            <button
              className="primary"
              disabled={busy}
              onClick={() => runAllocationCenterpiece()}
            >
              {busy && step !== "idle" && step !== "settled"
                ? "Running matching demo…"
                : "Run allocation matching demo"}
            </button>
            <button disabled={busy} onClick={() => openDesk()}>
              Open desk only
            </button>
            <button
              className="danger"
              disabled={busy || !composition}
              onClick={() => submitMismatchOnly()}
            >
              Submit wrong amount
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => oneClickSettle()}
            >
              One-click settle
            </button>
          </div>
          {step === "settled" && (
            <p style={{ marginTop: 16, marginBottom: 0 }}>
              <Link className="btn primary" href="/observer">
                Prove money shot →
              </Link>
            </p>
          )}
        </div>

        <div className="stack-sm desk-side">
          <div className="card card-mint adopt-panel">
            <h2>Why builders adopt this</h2>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Same 3-party DvP — call the layer vs rewrite coordination.
            </p>
            <div className="loc-compare" aria-label="Lines of code comparison">
              <div>
                <span className="loc-label">With Settle Flow</span>
                <strong className="loc-n">~99</strong>
                <span className="loc-unit">LOC</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Propose → Allocate → Settle
                </span>
              </div>
              <div className="loc-vs">vs</div>
              <div>
                <span className="loc-label">Hand-rolled</span>
                <strong className="loc-n loc-n-warn">~192</strong>
                <span className="loc-unit">LOC</span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Accept gate + match + receipt
                </span>
              </div>
            </div>
            <p className="card-body" style={{ marginBottom: 0, fontSize: 13 }}>
              ~2× less Daml surface for one deal — and you don&apos;t pay it again
              per workflow. Measured in{" "}
              <code style={{ fontSize: 12 }}>docs/SIDE_BY_SIDE.md</code> ·{" "}
              <code style={{ fontSize: 12 }}>examples/</code>.
            </p>
          </div>
          <div className="card card-lime">
            <h2>Judge path (default)</h2>
            <ul className="proof-list">
              <li>1. Propose + accept → agreement</li>
              <li>2. Allocate CBTC (match)</li>
              <li>3. Wrong USDCx amount → reject</li>
              <li>4. Correct cETH + settle</li>
            </ul>
          </div>
          <div className="card card-lavender">
            <h2>Load evidence</h2>
            <button disabled={busy} onClick={runBatch}>
              Settle 50 tickets
            </button>
            {loadStats && (
              <p className="mono" style={{ marginTop: 12, marginBottom: 0 }}>
                {loadStats.ran} ran · {loadStats.metrics.compositionsSettled}{" "}
                settled
              </p>
            )}
          </div>
        </div>
      </div>

      {mismatchReason && (
        <div className="card card-blush" style={{ marginTop: 20 }}>
          <h2>Allocation rejected</h2>
          <p className="err mono" style={{ marginBottom: 0, fontSize: 14 }}>
            {mismatchReason}
          </p>
          <p className="muted" style={{ marginTop: 8, fontSize: 14 }}>
            No partial commit — allocations on the deal unchanged. Correct the
            pledge to continue.
          </p>
        </div>
      )}

      {error && (
        <div className="card card-blush" style={{ marginTop: 20 }}>
          <h2>Error</h2>
          <p className="err" style={{ marginBottom: 0 }}>
            {error}
          </p>
        </div>
      )}

      {log.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>Live commits</h2>
          <ol className="mono" style={{ fontSize: 13, margin: 0, paddingLeft: 18 }}>
            {log.map((line, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {line}
              </li>
            ))}
          </ol>
          {composition && composition.commits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
                Ledger-shaped commits on this deal
              </p>
              <ul className="ticket-legs">
                {composition.commits.map((cm) => (
                  <li key={cm.updateId + cm.choice}>
                    <span>
                      {cm.choice} · {cm.contractId}
                    </span>
                    <strong>{cm.updateId}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {composition?.status === "settled" && moneyShot && (
        <div className="split" style={{ marginTop: 28 }}>
          <div className="card card-mint">
            <h2>Lender view</h2>
            <span className="tag ok">
              Tokens: {moneyShot.participant.visibleTokens.length}
            </span>
            <p className="muted" style={{ fontSize: 14 }}>
              Receipt: {composition.receiptCid}
            </p>
          </div>
          <div className="card card-lavender">
            <h2>Auditor preview</h2>
            {observerEmpty ? (
              <div className="empty-state" style={{ marginTop: 8 }}>
                visibleTokens: []
              </div>
            ) : (
              <span className="tag warn">Unexpected tokens</span>
            )}
            <Link className="btn primary" href="/observer">
              Open full money shot →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
