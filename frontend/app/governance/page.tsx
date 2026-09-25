"use client";

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

export default function GovernancePage() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [govs, setGovs] = useState<Governance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeGov, setActiveGov] =
    useState<(typeof GOVERNORS)[number]>("Gov1");

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
      setSuccessMsg("Opened a 2-of-3 governed deal. Collect signatures below.");
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
      setSuccessMsg(`${govName} signed.`);
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
    try {
      const result = await api<Composition>(
        `/compositions/governance/${id}/execute`,
        { method: "POST", body: "{}" },
      );
      await refresh();
      setSuccessMsg(
        `Threshold met. Deal ${result.id.slice(0, 8)} settled atomically.`,
      );
    } catch (e) {
      const msg = String((e as Error).message);
      if (expectFail || msg.includes("below threshold")) {
        setSuccessMsg(`Blocked below threshold: ${msg}`);
      } else {
        setError(msg);
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function runFullGovernanceDemo() {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
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

      await api(`/compositions/governance/${govId}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor: "Gov1" }),
      });

      try {
        await api(`/compositions/governance/${govId}/execute`, {
          method: "POST",
          body: "{}",
        });
      } catch {
        /* expected reject */
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
      setSuccessMsg(
        "Walkthrough complete: rejected at 1/2, settled at 2/2.",
      );
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
          BitSafe · 2-of-3
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Governed settlement</h1>
        <p className="lede">
          High-value tickets wait for threshold signatures. Sign as a governor,
          try to execute early to prove rejection, then hit the threshold and
          settle.
        </p>
      </div>

      <div className="row">
        <button className="primary" disabled={busy} onClick={startGoverned}>
          Open governed deal
        </button>
        <button disabled={busy} onClick={runFullGovernanceDemo}>
          Walk through reject → approve → settle
        </button>
        <Link className="btn" href="/demo">
          Ungoverned desk
        </Link>
      </div>

      <div className="card card-mint" style={{ marginBottom: 20 }}>
        <h2>Acting as</h2>
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

      {successMsg && <div className="flash-ok">{successMsg}</div>}
      {error && <p className="err">{error}</p>}

      <div className="grid grid-2">
        <div className="card card-lavender">
          <h2>Open governed deals</h2>
          {loading && govs.length === 0 ? (
            <SkeletonBlock rows={5} />
          ) : govs.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>
              No governed deals yet. Open one above.
            </p>
          ) : (
            govs.map((g) => {
              const comp = comps.find((c) => c.id === g.compositionId);
              const isThresholdMet = g.approvals.length >= g.threshold;
              const hasActiveGovApproved = g.approvals.includes(activeGov);

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

                  <div className="asset-chips">
                    {g.governors.map((govName) => {
                      const approved = g.approvals.includes(govName);
                      return (
                        <span
                          key={govName}
                          className={`tag ${approved ? "ok" : "empty"}`}
                        >
                          {approved ? `${govName} ✓` : `${govName} · waiting`}
                        </span>
                      );
                    })}
                  </div>

                  {g.status === "open" && (
                    <div className="row" style={{ marginBottom: 0, marginTop: 12 }}>
                      {!hasActiveGovApproved && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => approve(g.id, activeGov)}
                        >
                          Sign as {activeGov}
                        </button>
                      )}
                      {!isThresholdMet && (
                        <button
                          className="danger"
                          disabled={busy}
                          onClick={() => execute(g.id, true)}
                        >
                          Try execute early
                        </button>
                      )}
                      {isThresholdMet && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => execute(g.id, false)}
                        >
                          Execute settlement
                        </button>
                      )}
                    </div>
                  )}
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
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
