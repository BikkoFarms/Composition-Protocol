"use client";

/**
 * Proposer Dashboard — Alice (Commodity Exporter)
 *
 * Allows the deal initiator to:
 * 1. Inspect their active asset portfolio (e.g. CBTC collateral tokens).
 * 2. Propose new multi-asset compositions targeting specific counterparties.
 * 3. Track counterparty acceptance across the Daml AcceptanceTracker lifecycle.
 * 4. Execute atomic settlement once all counterparties have accepted.
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

type Token = {
  contractId: string;
  owner: string;
  instrumentId: string;
  amount: string;
};

type Composition = {
  id: string;
  status: string;
  description: string;
  accepted: string[];
  counterparties: string[];
  legs: { legId: string; instrumentId: string; amount: string }[];
  receiptCid?: string | null;
};

export default function ProposerPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [comps, setComps] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      api<{ tokens: Token[] }>("/assets?party=Alice"),
      api<{ compositions: Composition[] }>("/compositions"),
    ]);
    setTokens(t.tokens);
    setComps(c.compositions);
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message ?? e)));
  }, [refresh]);

  async function propose(forceFail = false) {
    setBusy(true);
    setError(null);
    try {
      await api("/compositions/demo/trade-finance", {
        method: "POST",
        body: JSON.stringify({ forceFail }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function settle(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/${id}/settle`, {
        method: "POST",
        body: JSON.stringify({ withRegulator: true }),
      });
      await refresh();
    } catch (e) {
      setError(String((e as Error).message));
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Proposer</h1>
      <p className="lede">
        Alice (exporter) proposes a three-leg trade-finance composition:
        CBTC collateral, USDCx cash, oracle attestation.
      </p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => propose(false)}>
          Propose trade-finance deal
        </button>
        <button className="danger" disabled={busy} onClick={() => propose(true)}>
          Propose failing deal (atomic revert)
        </button>
      </div>
      {error && <p className="err">{error}</p>}

      <div className="grid grid-2">
        <div className="panel">
          <h2>Alice visible tokens</h2>
          <table>
            <thead>
              <tr>
                <th>Instrument</th>
                <th>Amount</th>
                <th>CID</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.contractId}>
                  <td>{t.instrumentId}</td>
                  <td>{t.amount}</td>
                  <td>{t.contractId.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h2>Compositions</h2>
          {comps.length === 0 && (
            <p className="mono" style={{ color: "var(--muted)" }}>
              No compositions yet.
            </p>
          )}
          {comps.map((c) => (
            <div key={c.id} style={{ marginBottom: "1rem" }}>
              <div className="row">
                <span className="tag">{c.status}</span>
                <span className="mono">{c.id.slice(0, 8)}</span>
              </div>
              <p style={{ margin: "0.35rem 0", color: "var(--muted)" }}>
                {c.description}
              </p>
              <p className="mono">
                accepted: [{c.accepted.join(", ") || "—"}] / required: [
                {c.counterparties.join(", ")}]
              </p>
              {c.status === "accepted" && (
                <button
                  style={{ marginTop: "0.5rem" }}
                  disabled={busy}
                  onClick={() => settle(c.id)}
                >
                  Settle atomically
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
