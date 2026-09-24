"use client";

/**
 * Counterparty Dashboard — Bob (Lender) & Oracle (Quality Inspection)
 *
 * Demonstrates the co-signing flow:
 * 1. Counterparties inspect compositions where they are named participants.
 * 2. Each counterparty reviews the leg specifications and co-signs using the Daml `AcceptProposal` choice.
 * 3. The `AcceptanceTracker` accumulates signatures until all required counterparties agree, unlocking `FinalizeAgreement` and `Settle`.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Composition = {
  id: string;
  status: string;
  description: string;
  dealHash?: string;
  collateralRatio?: string;
  ltvPercent?: number;
  accepted: string[];
  counterparties: string[];
  legs: {
    legId: string;
    instrumentId: string;
    amount: string;
    provider: string;
    receiver: string;
    cantonDomain?: string;
  }[];
};

const ROLES = ["Bob", "Oracle"] as const;

export default function CounterpartyPage() {
  const [party, setParty] = useState<(typeof ROLES)[number]>("Bob");
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const view = await api<{
      compositions: Composition[];
    }>(`/audit/view/${party}`);
    setComps(view.compositions.filter((c) => c.status !== "settled"));
  }, [party]);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, [refresh]);

  async function accept(id: string) {
    setBusy(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await api(`/compositions/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: party }),
      });
      await refresh();
      setSuccessMsg(`✓ Acceptance recorded for ${party}. Co-signature attached to AcceptanceTracker.`);
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.3rem 0.8rem", borderRadius: "9999px", background: "rgba(6, 182, 212, 0.12)", border: "1px solid rgba(6, 182, 212, 0.3)", marginBottom: "0.85rem" }}>
          <span className="pulse-dot" style={{ backgroundColor: "#06b6d4", boxShadow: "0 0 10px #06b6d4" }} />
          <span className="mono" style={{ fontSize: "0.78rem", color: "#67e8f9", fontWeight: 600 }}>
            Counterparty Portal · Multi-Party Acceptance Tracker
          </span>
        </div>
        <h1>Counterparty Co-Signing Portal</h1>
        <p className="lede">
          Lender (Bob) and Quality Oracle review deal terms, collateral pledges, and cross-domain routing specifications before co-signing into the Daml AcceptanceTracker.
        </p>
      </div>

      {/* Role Switcher */}
      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: "var(--muted)", fontSize: "0.9rem" }}>
            Counterparty Perspective:
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {ROLES.map((r) => (
              <button
                key={r}
                className={party === r ? "primary" : undefined}
                style={{ padding: "0.45rem 1rem", fontSize: "0.85rem" }}
                onClick={() => setParty(r)}
              >
                Act as {r} {r === "Bob" ? "(Lender)" : "(Quality Oracle)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="panel" style={{ borderColor: "rgba(16, 185, 129, 0.4)", background: "rgba(16, 185, 129, 0.08)", marginBottom: "1.5rem" }}>
          <p className="mono" style={{ color: "#6ee7b7", margin: 0, fontWeight: 600 }}>
            {successMsg}
          </p>
        </div>
      )}

      {error && <div className="err">{error}</div>}

      <div className="panel panel-glow-accent">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>Open Composition Proposals For {party} ({comps.length})</h2>
          <span className="mono" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Scoped ACS View</span>
        </div>

        {comps.length === 0 ? (
          <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)", background: "rgba(0,0,0,0.25)", borderRadius: "8px" }} className="mono">
            No pending compositions to accept for {party}. Create one from the Proposer view or Pitch Demo.
          </div>
        ) : (
          comps.map((c) => {
            const hasAccepted = c.accepted.includes(party);
            return (
              <div
                key={c.id}
                style={{
                  border: "1px solid var(--line-glass)",
                  borderRadius: "10px",
                  padding: "1.25rem",
                  marginBottom: "1.25rem",
                  background: "rgba(10, 18, 14, 0.75)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <div>
                    <span className="mono" style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>
                      {c.description}
                    </span>
                    {c.dealHash && (
                      <p className="mono" style={{ fontSize: "0.72rem", color: "var(--subtle)", margin: "0.2rem 0 0" }}>
                        Digest: {c.dealHash.slice(0, 20)}…
                      </p>
                    )}
                  </div>
                  <span className={`tag ${c.status === "accepted" ? "ok" : "warn"}`}>
                    {c.status}
                  </span>
                </div>

                <table>
                  <thead>
                    <tr>
                      <th>Leg ID</th>
                      <th>Instrument</th>
                      <th>Amount</th>
                      <th>Transfer Flow</th>
                      <th>Canton Domain Routing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.legs.map((l) => (
                      <tr key={l.legId}>
                        <td className="mono">{l.legId}</td>
                        <td>
                          <span className="tag cyan">{l.instrumentId}</span>
                        </td>
                        <td className="mono" style={{ fontWeight: 700, color: "#fff" }}>{l.amount}</td>
                        <td className="mono" style={{ color: "#6ee7b7" }}>
                          {l.provider} → {l.receiver}
                        </td>
                        <td className="mono" style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                          {l.cantonDomain ?? "canton-domain-01"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
                  <span className="mono" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                    Accepted: [{c.accepted.join(", ") || "none"}] / Required: [{c.counterparties.join(", ")}]
                  </span>

                  {!hasAccepted && c.counterparties.includes(party) && c.status !== "reverted" && (
                    <button
                      className="primary"
                      style={{ padding: "0.5rem 1.2rem", fontSize: "0.88rem" }}
                      disabled={busy}
                      onClick={() => accept(c.id)}
                    >
                      ✓ Co-Sign Deal As {party}
                    </button>
                  )}

                  {hasAccepted && (
                    <span className="tag ok" style={{ fontSize: "0.82rem" }}>
                      ✓ Signed by {party}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
