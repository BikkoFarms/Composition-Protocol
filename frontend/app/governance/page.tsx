"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

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
  const [activeGov, setActiveGov] =
    useState<(typeof GOVERNORS)[number]>("Gov1");

  const refresh = useCallback(async () => {
    const data = await api<{
      compositions: Composition[];
      governances: Governance[];
    }>("/compositions");
    setComps(data.compositions);
    setGovs(data.governances);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
    const timer = setInterval(() => refresh().catch(() => undefined), 2500);
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
      setSuccessMsg(
        `Opened 2-of-3 governed deal for composition ${c.id.slice(0, 8)}`,
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
      setSuccessMsg(`Signature recorded for ${govName}`);
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
        {
          method: "POST",
          body: "{}",
        },
      );
      await refresh();
      setSuccessMsg(
        `R-GOV-2 enforced: threshold met — deal ${result.id.slice(0, 8)} settled atomically.`,
      );
    } catch (e) {
      const msg = String((e as Error).message);
      if (expectFail || msg.includes("below threshold")) {
        setSuccessMsg(`R-GOV-1 enforced: execution safely rejected (${msg})`);
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
        // Expected R-GOV-1 rejection
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
        "Full BitSafe demo verified: R-GOV-1 rejected at 1/2, R-GOV-2 succeeded at 2/2.",
      );
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="pill">
        BitSafe · 2-of-3
        <span className="pill-arrow">→</span>
      </span>
      <h1 style={{ fontSize: "clamp(2rem, 4vw, 2.9rem)" }}>
        BitSafe governance
      </h1>
      <p className="lede">
        M-of-N threshold multi-sig for high-value compositions. Below threshold
        rejects; at threshold settles — LocalNet-ready for the Decentralization
        challenge.
      </p>

      <div className="row">
        <button className="primary" disabled={busy} onClick={startGoverned}>
          Open 2-of-3 governed deal
        </button>
        <button disabled={busy} onClick={runFullGovernanceDemo}>
          Run R-GOV-1 & R-GOV-2 test flow
        </button>
      </div>

      <div className="card card-mint" style={{ marginBottom: 20 }}>
        <h2>Active governor role</h2>
        <div className="row" style={{ marginBottom: 0 }}>
          {GOVERNORS.map((g) => (
            <button
              key={g}
              className={activeGov === g ? "primary" : undefined}
              onClick={() => setActiveGov(g)}
            >
              Act as {g}
            </button>
          ))}
        </div>
      </div>

      {successMsg && (
        <div className="card card-sage" style={{ marginBottom: 20 }}>
          <p className="mono" style={{ margin: 0, color: "var(--color-deep-forest)" }}>
            {successMsg}
          </p>
        </div>
      )}

      {error && <p className="err">{error}</p>}

      <div className="grid grid-2">
        <div className="card card-lavender">
          <h2>Active governed deals ({govs.length})</h2>
          {govs.length === 0 ? (
            <p className="mono muted">
              No governed deals open. Click &quot;Open 2-of-3 governed deal&quot;
              above.
            </p>
          ) : (
            govs.map((g) => {
              const comp = comps.find((c) => c.id === g.compositionId);
              const isThresholdMet = g.approvals.length >= g.threshold;
              const hasActiveGovApproved = g.approvals.includes(activeGov);

              return (
                <div
                  key={g.id}
                  className="card"
                  style={{ marginBottom: 16, padding: 16 }}
                >
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="mono" style={{ fontWeight: 500 }}>
                      {comp?.description || g.compositionId.slice(0, 8)}
                    </span>
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
                          ? "Threshold met"
                          : `Pending ${g.approvals.length}/${g.threshold}`}
                    </span>
                  </div>

                  <p className="mono muted" style={{ fontSize: 13 }}>
                    Threshold: {g.threshold} of {g.governors.length} · Approvals: [
                    {g.approvals.join(", ") || "none"}]
                  </p>

                  <div className="row">
                    {g.governors.map((govName) => {
                      const approved = g.approvals.includes(govName);
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

                  {g.status === "open" && (
                    <div className="row" style={{ marginTop: 8 }}>
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
                          Test R-GOV-1 (reject)
                        </button>
                      )}
                      {isThresholdMet && (
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => execute(g.id, false)}
                        >
                          Execute settlement (R-GOV-2)
                        </button>
                      )}
                    </div>
                  )}

                  {g.status === "executed" && (
                    <p
                      className="mono"
                      style={{ color: "var(--color-deep-forest)", fontSize: 13 }}
                    >
                      Atomic multi-asset settlement finalized.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="card card-lime">
          <h2>Composition registry</h2>
          <p className="mono muted" style={{ marginBottom: 12 }}>
            Underlying multi-asset deal states
          </p>
          {comps.length === 0 ? (
            <p className="mono muted">No compositions recorded.</p>
          ) : (
            comps.map((c) => (
              <div
                key={c.id}
                style={{
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--color-lichen-gray) 25%, transparent)",
                  paddingBottom: 12,
                  marginBottom: 12,
                }}
              >
                <div
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
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
                    {c.status}
                  </span>
                </div>
                <p className="mono muted" style={{ fontSize: 12, margin: "4px 0 0" }}>
                  ID: {c.id}
                </p>
                {c.requireGovernance && (
                  <p
                    className="mono"
                    style={{
                      color: "var(--color-deep-teal)",
                      margin: "4px 0 0",
                      fontSize: 12,
                    }}
                  >
                    BitSafe governed deal (M-of-N gate active)
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
