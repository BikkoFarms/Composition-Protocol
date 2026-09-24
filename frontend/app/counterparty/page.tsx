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
  accepted: string[];
  counterparties: string[];
  legs: {
    legId: string;
    instrumentId: string;
    amount: string;
    provider: string;
    receiver: string;
  }[];
};

const ROLES = ["Bob", "Oracle"] as const;

export default function CounterpartyPage() {
  const [party, setParty] = useState<(typeof ROLES)[number]>("Bob");
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
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
    try {
      await api(`/compositions/${id}/accept`, {
        method: "POST",
        body: JSON.stringify({ acceptor: party }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Counterparty</h1>
      <p className="lede">
        Lender (Bob) and Oracle co-sign the proposal. AcceptanceTracker fills
        until every required party has accepted — then Settle is unlocked.
      </p>
      <div className="row">
        {ROLES.map((r) => (
          <button
            key={r}
            className={party === r ? "primary" : undefined}
            onClick={() => setParty(r)}
          >
            Act as {r}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}

      <div className="panel">
        <h2>Open compositions for {party}</h2>
        {comps.length === 0 && (
          <p className="mono" style={{ color: "var(--muted)" }}>
            Nothing to accept. Propose a deal from the Proposer view.
          </p>
        )}
        {comps.map((c) => (
          <div key={c.id} style={{ marginBottom: "1.25rem" }}>
            <div className="row">
              <span className={`tag ${c.status === "accepted" ? "ok" : "warn"}`}>
                {c.status}
              </span>
              <span className="mono">{c.description}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Leg</th>
                  <th>Asset</th>
                  <th>Amount</th>
                  <th>From → To</th>
                </tr>
              </thead>
              <tbody>
                {c.legs.map((l) => (
                  <tr key={l.legId}>
                    <td>{l.legId}</td>
                    <td>{l.instrumentId}</td>
                    <td>{l.amount}</td>
                    <td>
                      {l.provider} → {l.receiver}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!c.accepted.includes(party) &&
              c.counterparties.includes(party) &&
              c.status !== "reverted" && (
                <button
                  className="primary"
                  style={{ marginTop: "0.75rem" }}
                  disabled={busy}
                  onClick={() => accept(c.id)}
                >
                  Accept as {party}
                </button>
              )}
            {c.accepted.includes(party) && (
              <p className="mono" style={{ color: "var(--ok)" }}>
                Already accepted.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
