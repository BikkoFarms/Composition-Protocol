"use client";

/**
 * Lender / Oracle desk — accept or reject proposals (John's reject path).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";
import { formatAmount, friendlyError } from "@/lib/trades";

type Composition = {
  id: string;
  commits?: { choice: string; actAs: string[]; at: string }[];
  tradeName?: string;
  status: string;
  description: string;
  accepted: string[];
  counterparties: string[];
  expiresAt?: string;
  rejectionReason?: string;
  disclosedContracts?: { contractId: string; payload?: Record<string, unknown> }[];
  legs: {
    legId: string;
    instrumentId: string;
    amount: string;
    provider: string;
    receiver: string;
  }[];
};

const ROLES = ["Bob", "Oracle"] as const;
const ACTIONABLE = new Set(["proposed", "partially_accepted"]);

export default function CounterpartyPage() {
  const [party, setParty] = useState<(typeof ROLES)[number]>("Bob");
  const [comps, setComps] = useState<Composition[]>([]);
  const [history, setHistory] = useState<Composition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const view = await api<{ compositions: Composition[] }>(
      `/audit/view/${party}`,
    );
    const closed = ["settled", "cancelled", "expired", "rejected", "reverted"];
    const mine = [...view.compositions]
      .reverse()
      .filter((c) => c.counterparties.includes(party));
    setComps(mine.filter((c) => !closed.includes(c.status)));
    setHistory(mine.filter((c) => closed.includes(c.status)).slice(0, 10));
    setLoading(false);
  }, [party]);

  useEffect(() => {
    setLoading(true);
    refresh().catch((e) => {
      setError(String(e.message ?? e));
      setLoading(false);
    });
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
      setError(friendlyError(String((e as Error).message)));
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api(`/compositions/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({
          rejector: party,
          reason:
            party === "Bob"
              ? "Margin terms rejected by lender"
              : "Sponsor / inspection terms rejected by oracle",
        }),
      });
      await refresh();
    } catch (e) {
      setError(friendlyError(String((e as Error).message)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <span className="pill">
          Lender desk
          <span className="pill-arrow">→</span>
        </span>
        <h1 className="page-title">Review and co-sign</h1>
        <p className="lede">
          Switch between lender (Bob) and oracle. Accept to advance the
          AcceptanceTracker, or reject cleanly so nothing half-settles.
        </p>
      </div>
      <div className="row">
        {ROLES.map((r) => (
          <button
            key={r}
            className={party === r ? "primary" : undefined}
            onClick={() => setParty(r)}
          >
            {r === "Bob" ? "Lender (Bob)" : "Oracle"}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}

      <div className="card card-lime">
        <h2>Inbox for {party === "Bob" ? "Lender" : "Oracle"}</h2>
        {loading && comps.length === 0 && <SkeletonBlock rows={4} />}
        {!loading && comps.length === 0 && (
          <p className="muted" style={{ fontSize: 14 }}>
            Nothing waiting.{" "}
            <Link className="link-arrow" href="/proposer">
              Ask the exporter to propose
            </Link>
            .
          </p>
        )}
        {comps.map((c) => (
          <div key={c.id} className="deal-card">
            <div className="deal-card-head">
              <span className={`tag ${c.status === "accepted" ? "ok" : "warn"}`}>
                {c.status.replaceAll("_", " ")}
              </span>
              <span style={{ fontSize: 14 }}>
                <strong>{c.tradeName ?? "Trade"}</strong>
                <span className="muted"> · {c.description}</span>
              </span>
            </div>
            {c.disclosedContracts && c.disclosedContracts.length > 0 && (
              <div className="asset-chips" style={{ marginBottom: 10 }}>
                <span className="tag cyan">
                  {c.disclosedContracts.length} disclosed contract
                  {c.disclosedContracts.length > 1 ? "s" : ""}
                </span>
              </div>
            )}
            <div className="card" style={{ marginTop: 8, padding: 16 }}>
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
                      <td>{formatAmount(l.amount)}</td>
                      <td>
                        {l.provider} → {l.receiver}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!c.accepted.includes(party) &&
              c.counterparties.includes(party) &&
              ACTIONABLE.has(c.status) && (
                <div className="row" style={{ marginTop: 12, marginBottom: 0 }}>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => accept(c.id)}
                  >
                    Accept as {party === "Bob" ? "Lender" : "Oracle"}
                  </button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => reject(c.id)}
                  >
                    Reject proposal
                  </button>
                </div>
              )}
            {c.accepted.includes(party) && (
              <p style={{ color: "var(--color-deep-forest)", fontSize: 14 }}>
                ✓ You signed
                {(() => {
                  const sig = c.commits?.find(
                    (x) => x.choice === "AcceptProposal" && x.actAs.includes(party),
                  );
                  return sig ? ` at ${new Date(sig.at).toLocaleTimeString()}` : "";
                })()}
                .{" "}
                {c.accepted.length === c.counterparties.length ? (
                  <Link href={`/demo?id=${c.id}`} style={{ fontWeight: 600 }}>
                    Fully signed — now on the Settlement desk →
                  </Link>
                ) : (
                  "Waiting for the other counterparty to sign."
                )}
              </p>
            )}
          </div>
        ))}
      </div>

      {history.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h2>History for {party === "Bob" ? "Lender" : "Oracle"}</h2>
          <table>
            <thead>
              <tr>
                <th>Trade</th>
                <th>Your signature</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {history.map((c) => {
                const sig = c.commits?.find(
                  (x) => x.choice === "AcceptProposal" && x.actAs.includes(party),
                );
                return (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.tradeName ?? "Trade"}</strong>{" "}
                      <span className="mono muted">#{c.id.slice(0, 8)}</span>
                    </td>
                    <td>{sig ? `✓ ${new Date(sig.at).toLocaleTimeString()}` : "—"}</td>
                    <td>
                      {c.status === "settled" ? (
                        <Link href={`/observer?id=${c.id}`}>Settled · receipt →</Link>
                      ) : (
                        c.status
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
