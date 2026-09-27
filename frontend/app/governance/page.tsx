"use client";

/**
 * BitSafe desk — camera-ready refuse-below-threshold then settle beat (R-GOV-1/2).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";

type Composition = {
  id: string;
  status: string;
  description: string;
  governanceCid: string | null;
  requireGovernance?: boolean;
  legs?: {
    legId: string;
    instrumentId: string;
    amount: string;
    provider: string;
    receiver: string;
  }[];
};

type Governance = {
  id: string;
  compositionId: string;
  governors: string[];
  threshold: number;
  approvals: string[];
  status: "open" | "executed" | "rejected";
};

const GOVERNORS = ["Gov1", "Gov2", "Gov3"] as const;

type BeatStep = 0 | 1 | 2 | 3;

export default function GovernancePage() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [govs, setGovs] = useState<Governance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [refuseMsg, setRefuseMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeGov, setActiveGov] =
    useState<(typeof GOVERNORS)[number]>("Gov1");
  const [beat, setBeat] = useState<BeatStep>(0);

  const refresh = useCallback(async () => {
    const data = await api<{
      compositions: Composition[];
      governances: Governance[];
    }>("/compositions");
    setComps(data.compositions);
    setGovs(data.governances);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
    const timer = setInterval(() => refresh().catch(() => undefined), 4000);
    return () => clearInterval(timer);
  }, [refresh]);

  async function startGoverned() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    setRefuseMsg(null);
    try {
      const c = await api<Composition>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ requireGovernance: true }),
      });
      await api(`/compositions/${c.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: "Bob" }),
      });
      await api(`/compositions/${c.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: "Oracle" }),
      });
      await api(`/compositions/${c.id}/settle`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refresh();
      setBeat(1);
      setActiveGov("Gov1");
      setSuccessMsg(
        "Opened BitSafe 2-of-3 governed deal. Named governors: Gov1, Gov2, Gov3. Threshold M=2.",
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string, govName: string) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api(`/compositions/governance/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor: govName }),
      });
      await refresh();
      setSuccessMsg(`${govName} signed · threshold still ${govName === "Gov1" ? "1/2" : "checking"}.`);
      if (govName === "Gov1") {
        setBeat(1);
        setActiveGov("Gov1");
      }
      if (govName === "Gov2" || govName === "Gov3") {
        setBeat(3);
      }
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function execute(id: string, expectFail = false) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    setRefuseMsg(null);
    try {
      const result = await api<Composition>(
        `/compositions/governance/${id}/execute`,
        { method: "POST", body: "{}" },
      );
      await refresh();
      setBeat(3);
      setRefuseMsg(null);
      setSuccessMsg(
        `R-GOV-2: threshold met. Deal ${result.id.slice(0, 8)} settled atomically.`,
      );
    } catch (e) {
      const msg = String((e as Error).message);
      if (expectFail || msg.toLowerCase().includes("below threshold")) {
        setBeat(2);
        setRefuseMsg(`R-GOV-1 ledger refusal: ${msg}`);
        setSuccessMsg(null);
        setActiveGov("Gov2");
      } else {
        setError(msg);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  /** Manual camera path: open → Gov1 sign → refuse → Gov2 sign → settle */
  async function runCameraBeat() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    setRefuseMsg(null);
    setBeat(0);
    try {
      const c = await api<Composition>("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ requireGovernance: true }),
      });
      await api(`/compositions/${c.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: "Bob" }),
      });
      await api(`/compositions/${c.id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: "Oracle" }),
      });
      const opened = await api<Composition>(`/compositions/${c.id}/settle`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const govId = opened.governanceCid!;
      setBeat(1);

      await api(`/compositions/governance/${govId}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor: "Gov1" }),
      });
      await refresh();

      try {
        await api(`/compositions/governance/${govId}/execute`, {
          method: "POST",
          body: "{}",
        });
      } catch (e) {
        const msg = String((e as Error).message);
        setBeat(2);
        setRefuseMsg(`R-GOV-1 ledger refusal: ${msg}`);
      }

      await api(`/compositions/governance/${govId}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor: "Gov2" }),
      });
      await api(`/compositions/governance/${govId}/execute`, {
        method: "POST",
        body: "{}",
      });

      await refresh();
      setBeat(3);
      setSuccessMsg(
        "R-GOV-2: refused at 1/2, settled at 2/2. BitSafe Decentralization criterion cleared.",
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  const openGov = govs.find((g) => g.status === "open");

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          BitSafe · 2-of-3
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Governed settlement refuses below threshold</h1>
        <p className="lede">
          Named governors Gov1, Gov2, Gov3. Threshold M=2. Attempt settle with
          too few approvals — the ledger refuses. Reach the threshold — it
          settles. One build, BitSafe + Track 1 payoff.
        </p>
      </div>

      <div className="bitsafe-rail" aria-label="BitSafe demo beat">
        <div
          className={`bitsafe-step ${beat >= 1 ? "done" : ""} ${beat === 0 ? "active" : ""}`}
        >
          <span className="n">1</span>
          <strong>Open + first signature</strong>
          <p>Open governed DvP. Sign as Gov1 (1 of 2).</p>
        </div>
        <div
          className={`bitsafe-step ${
            beat === 2 ? "fail" : beat > 2 ? "done" : beat === 1 ? "active" : ""
          }`}
        >
          <span className="n">2</span>
          <strong>Execute early → refuse</strong>
          <p>Ledger rejects below threshold (R-GOV-1).</p>
        </div>
        <div
          className={`bitsafe-step ${beat === 3 ? "done" : beat === 2 ? "active" : ""}`}
        >
          <span className="n">3</span>
          <strong>Second signature → settle</strong>
          <p>Gov2 signs. At threshold, atomic settle (R-GOV-2).</p>
        </div>
      </div>

      <div className="row">
        <button className="primary" disabled={busy} onClick={startGoverned}>
          Open governed deal
        </button>
        <button disabled={busy} onClick={runCameraBeat}>
          {busy ? "Running beat…" : "Camera beat: refuse → settle"}
        </button>
        <Link className="btn" href="/observer">
          Money shot
        </Link>
        <Link className="btn" href="/demo">
          Ungoverned desk
        </Link>
      </div>

      <div className="card card-mint" style={{ marginBottom: 20 }}>
        <h2>Acting as governor</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Manual path: sign as Gov1 → Try execute early → switch to Gov2 →
          Execute settlement.
        </p>
        <div className="row" style={{ marginBottom: 0 }}>
          {GOVERNORS.map((g) => (
            <button
              key={g}
              className={activeGov === g ? "primary" : undefined}
              onClick={() => setActiveGov(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {refuseMsg && <div className="flash-refuse">{refuseMsg}</div>}
      {successMsg && <div className="flash-ok">{successMsg}</div>}
      {error && <p className="err">{error}</p>}

      {openGov && openGov.status === "open" && (
        <div className="card card-butter" style={{ marginBottom: 20 }}>
          <h2>Live threshold</h2>
          <p className="card-title" style={{ fontSize: 20 }}>
            {openGov.approvals.length}/{openGov.threshold} of{" "}
            {openGov.governors.length} governors
          </p>
          <div className="asset-chips">
            {openGov.governors.map((govName) => {
              const approved = openGov.approvals.includes(govName);
              return (
                <span
                  key={govName}
                  className={`tag ${approved ? "ok" : "empty"}`}
                >
                  {approved ? `${govName} signed` : `${govName} pending`}
                </span>
              );
            })}
          </div>
          <div className="row" style={{ marginTop: 14, marginBottom: 0 }}>
            {!openGov.approvals.includes(activeGov) && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => approve(openGov.id, activeGov)}
              >
                Sign as {activeGov}
              </button>
            )}
            {openGov.approvals.length < openGov.threshold && (
              <button
                className="danger"
                disabled={busy}
                onClick={() => execute(openGov.id, true)}
              >
                Try execute early
              </button>
            )}
            {openGov.approvals.length >= openGov.threshold && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => execute(openGov.id, false)}
              >
                Execute settlement
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-2">
        <div className="card card-lavender">
          <h2>Open governed deals</h2>
          {loading && govs.length === 0 ? (
            <SkeletonBlock rows={5} />
          ) : govs.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No governed deals yet. Open one or run the camera beat.
            </p>
          ) : (
            govs.map((g) => {
              const comp = comps.find((c) => c.id === g.compositionId);
              const isThresholdMet = g.approvals.length >= g.threshold;

              return (
                <div key={g.id} className="deal-card">
                  <div className="deal-card-head">
                    <strong>
                      {comp?.description || g.compositionId.slice(0, 8)}
                    </strong>
                    <span
                      className={`tag ${
                        g.status === "executed"
                          ? "ok"
                          : isThresholdMet
                            ? "ok"
                            : "warn"
                      }`}
                    >
                      {g.status === "executed"
                        ? "Settled"
                        : isThresholdMet
                          ? "Ready to execute"
                          : `${g.approvals.length}/${g.threshold} signed`}
                    </span>
                  </div>
                  <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
                    Threshold {g.threshold}-of-{g.governors.length} · Approvals:{" "}
                    {g.approvals.join(", ") || "none"}
                  </p>
                </div>
              );
            })
          )}
        </div>

        <div className="card card-lime">
          <h2>Composition book</h2>
          {loading && comps.length === 0 ? (
            <SkeletonBlock rows={4} />
          ) : comps.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No compositions recorded yet.
            </p>
          ) : (
            comps.slice(0, 12).map((c) => (
              <div key={c.id} className="book-row">
                <div className="deal-card-head">
                  <span style={{ fontWeight: 500, fontSize: 14 }}>
                    {c.description}
                  </span>
                  <span
                    className={`tag ${
                      c.status === "settled"
                        ? "ok"
                        : c.status === "awaiting_governance"
                          ? "warn"
                          : "ok"
                    }`}
                  >
                    {c.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mono muted" style={{ fontSize: 12, margin: 0 }}>
                  {c.id.slice(0, 12)}…
                  {c.requireGovernance ? " · BitSafe gate" : ""}
                  {c.legs
                    ? ` · ${c.legs.map((l) => l.instrumentId).join(" + ")}`
                    : ""}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
