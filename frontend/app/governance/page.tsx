"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Composition = {
  id: string;
  status: string;
  description: string;
  governanceCid: string | null;
  requireGovernance?: boolean;
};

type Governance = {
  id: string;
  compositionId: string;
  governors: string[];
  threshold: number;
  approvals: string[];
  status: string;
};

export default function GovernancePage() {
  const [comps, setComps] = useState<Composition[]>([]);
  const [govs, setGovs] = useState<Governance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [governor, setGovernor] = useState("Gov1");

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
  }, [refresh]);

  async function startGoverned() {
    setBusy(true);
    setError(null);
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
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function approve(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/governance/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ governor }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function execute(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/governance/${id}/execute`, { method: "POST", body: "{}" });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>BitSafe governance</h1>
      <p className="lede">
        M-of-N settlement control (2-of-3). Below threshold rejects; at threshold
        settles. LocalNet-reproducible for the BitSafe Decentralization challenge.
      </p>

      <div className="row">
        <button className="primary" disabled={busy} onClick={startGoverned}>
          Open 2-of-3 governed deal
        </button>
        {(["Gov1", "Gov2", "Gov3"] as const).map((g) => (
          <button
            key={g}
            className={governor === g ? "primary" : undefined}
            onClick={() => setGovernor(g)}
          >
            Act as {g}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}

      <div className="grid grid-2">
        <div className="panel">
          <h2>Compositions</h2>
          {comps.length === 0 && (
            <p className="mono" style={{ color: "var(--muted)" }}>
              None yet.
            </p>
          )}
          {comps.map((c) => (
            <div key={c.id} style={{ marginBottom: "0.85rem" }}>
              <span className="tag">{c.status}</span>{" "}
              <span className="mono">{c.id.slice(0, 8)}</span>
              <p style={{ color: "var(--muted)", margin: "0.35rem 0" }}>
                {c.description}
              </p>
            </div>
          ))}
        </div>
        <div className="panel">
          <h2>Governed settlements</h2>
          {govs.map((g) => (
            <div key={g.id} style={{ marginBottom: "1rem" }}>
              <p className="mono">
                {g.approvals.length}/{g.threshold} · [{g.approvals.join(", ") || "—"}] ·{" "}
                {g.status}
              </p>
              <div className="row">
                <button disabled={busy || g.status !== "open"} onClick={() => approve(g.id)}>
                  Approve as {governor}
                </button>
                <button
                  className="primary"
                  disabled={busy || g.status !== "open"}
                  onClick={() => execute(g.id)}
                >
                  Execute
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
