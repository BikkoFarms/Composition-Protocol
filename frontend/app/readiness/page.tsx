"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SkeletonBlock } from "@/components/Skeleton";

type LegReadiness = {
  legId: string;
  instrumentId: string;
  amount: string;
  provider: string;
  receiver: string;
  matched: boolean;
};

type OutstandingLeg = {
  legId: string;
  provider: string;
  receiver: string;
  instrumentId: string;
  amount: string;
  deadline: string;
};

type PartyStatus = {
  party: string;
  accepted: boolean;
  allocated?: boolean;
};

type ReadinessData = {
  compositionId: string;
  status: string;
  isReady: boolean;
  totalLegs: number;
  allocatedLegCount: number;
  allocatedLegs: LegReadiness[];
  outstandingLegs: OutstandingLeg[];
  parties: {
    proposer: PartyStatus;
    counterparties: PartyStatus[];
  };
  outstandingParties: string[];
  allocateBy?: string;
  settleBy?: string;
  isAllocateExpired?: boolean;
  isSettleExpired?: boolean;
  canSettle: boolean;
};

type CompositionSummary = {
  id: string;
  description: string;
  status: string;
};

export default function ReadinessPage() {
  const [compositions, setCompositions] = useState<CompositionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [readiness, setReadiness] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const fetchCompositions = useCallback(async () => {
    try {
      const res = await api<{ compositions: CompositionSummary[] }>("/compositions");
      setCompositions(res.compositions);
      if (res.compositions.length > 0 && !selectedId) {
        setSelectedId(res.compositions[0].id);
      }
    } catch {
      // ignore
    }
  }, [selectedId]);

  const fetchReadiness = useCallback(async (id: string) => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api<ReadinessData>(`/compositions/${id}/readiness`);
      setReadiness(data);
    } catch (err) {
      setMessage({ text: `Failed to load readiness: ${(err as Error).message}`, type: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompositions();
  }, [fetchCompositions]);

  useEffect(() => {
    if (selectedId) {
      fetchReadiness(selectedId);
      const interval = setInterval(() => fetchReadiness(selectedId), 4000);
      return () => clearInterval(interval);
    }
  }, [selectedId, fetchReadiness]);

  async function handleSettle() {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/compositions/${selectedId}/settle`, {
        method: "POST",
        body: JSON.stringify({ caller: "Operator" }),
      });
      setMessage({ text: "Atomic DvP settlement executed successfully!", type: "success" });
      await fetchReadiness(selectedId);
    } catch (err) {
      setMessage({ text: `Settlement rejected: ${(err as Error).message}`, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleAllocateAll() {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/compositions/${selectedId}/allocate-all`, { method: "POST" });
      setMessage({ text: "All legs allocated and matched against agreed terms!", type: "success" });
      await fetchReadiness(selectedId);
    } catch (err) {
      setMessage({ text: `Allocation failed: ${(err as Error).message}`, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdrawLeg(legId: string, caller: string) {
    if (!selectedId) return;
    setBusy(true);
    setMessage(null);
    try {
      await api(`/compositions/${selectedId}/withdraw-leg`, {
        method: "POST",
        body: JSON.stringify({ legId, caller }),
      });
      setMessage({ text: `Leg ${legId} withdrawn by ${caller}. Allocations unlocked.`, type: "info" });
      await fetchReadiness(selectedId);
    } catch (err) {
      setMessage({ text: `Withdraw failed: ${(err as Error).message}`, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSeedNewTrade() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ id: string }>("/compositions/demo/trade-finance", { method: "POST" });
      setSelectedId(res.id);
      await fetchCompositions();
      await fetchReadiness(res.id);
      setMessage({ text: `New 3-party DvP proposal created: ${res.id}`, type: "success" });
    } catch (err) {
      setMessage({ text: `Seed failed: ${(err as Error).message}`, type: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="layout-stack" style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 16px" }}>
      <header className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <span className="badge-chip" style={{ background: "var(--color-sage-glow)", color: "var(--color-deep-forest)" }}>
              PRD §8 · FR-11 Status View
            </span>
            <h1 style={{ fontSize: 28, margin: "8px 0 4px", fontWeight: 600 }}>Trade Readiness Dashboard</h1>
            <p style={{ color: "var(--color-lichen-gray)", margin: 0, fontSize: 14 }}>
              On-ledger readiness tracking across authorizations, CIP-56 allocations, and DvP settlement gates.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" onClick={handleSeedNewTrade} disabled={busy}>
              + Propose New Trade
            </button>
            <Link className="btn primary" href="/demo">
              Allocation Desk →
            </Link>
          </div>
        </div>
      </header>

      {/* Select active trade */}
      {compositions.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-slate)", display: "block", marginBottom: 6 }}>
            Select Active Composition
          </label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "var(--radius-inputs)",
              border: "1px solid var(--color-mist)",
              background: "white",
              fontSize: 14,
              fontFamily: "inherit",
            }}
          >
            {compositions.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.status.toUpperCase()}] {c.id.slice(0, 10)}... — {c.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {message && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 8,
            marginBottom: 20,
            fontSize: 14,
            background:
              message.type === "success"
                ? "var(--color-meadow)"
                : message.type === "error"
                ? "#fed7d7"
                : "var(--color-mint-surface)",
            color:
              message.type === "success"
                ? "var(--color-deep-forest)"
                : message.type === "error"
                ? "#9b2c2c"
                : "var(--color-deep-teal)",
          }}
        >
          {message.text}
        </div>
      )}

      {loading && !readiness ? (
        <SkeletonBlock rows={5} />
      ) : readiness ? (
        <div className="layout-stack" style={{ gap: 24 }}>
          {/* Readiness Summary Banner */}
          <div
            className="card"
            style={{
              padding: 24,
              borderLeft: readiness.isReady
                ? "6px solid #2a4e1c"
                : readiness.status === "settled"
                ? "6px solid #003d3d"
                : "6px solid #e2a03f",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-mist)" }}>
                  Settlement Readiness Status
                </span>
                <h2 style={{ fontSize: 22, margin: "4px 0", fontWeight: 600 }}>
                  {readiness.status === "settled"
                    ? "✓ Trade Settled Atomically"
                    : readiness.isReady
                    ? "✓ Ready to Settle (All Legs Matched)"
                    : "⏳ Awaiting Allocations / Authorizations"}
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: "var(--color-lichen-gray)" }}>
                  Allocations Matched: {readiness.allocatedLegCount} of {readiness.totalLegs} legs · Status: <strong>{readiness.status}</strong>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {!readiness.isReady && readiness.status !== "settled" && (
                  <button className="btn" onClick={handleAllocateAll} disabled={busy}>
                    ⚡ Allocate All Legs
                  </button>
                )}
                {readiness.canSettle && (
                  <button className="btn primary" onClick={handleSettle} disabled={busy} style={{ background: "#2a4e1c", color: "white" }}>
                    Execute DvP Settle →
                  </button>
                )}
              </div>
            </div>

            {/* Deadlines Section */}
            {(readiness.allocateBy || readiness.settleBy) && (
              <div
                style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: "1px solid #eee",
                  display: "flex",
                  gap: 24,
                  fontSize: 12,
                  color: "var(--color-slate)",
                }}
              >
                <div>
                  <strong>Allocate-By Deadline:</strong>{" "}
                  {readiness.allocateBy ? new Date(readiness.allocateBy).toLocaleString() : "None"}{" "}
                  {readiness.isAllocateExpired && <span style={{ color: "red" }}>(Expired)</span>}
                </div>
                <div>
                  <strong>Settle-By Deadline:</strong>{" "}
                  {readiness.settleBy ? new Date(readiness.settleBy).toLocaleString() : "None"}{" "}
                  {readiness.isSettleExpired && <span style={{ color: "red" }}>(Expired)</span>}
                </div>
              </div>
            )}
          </div>

          {/* Section 1: Party Authorizations */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 16px", fontWeight: 600 }}>1. Three-Party Authorizations</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ padding: 12, background: "var(--color-mint-surface)", borderRadius: 8 }}>
                <span style={{ fontSize: 11, color: "var(--color-lichen-gray)", textTransform: "uppercase" }}>Proposer</span>
                <div style={{ fontSize: 15, fontWeight: 600, margin: "2px 0" }}>{readiness.parties.proposer.party}</div>
                <span style={{ fontSize: 12, color: "green" }}>✓ Signed & Proposed</span>
              </div>
              {readiness.parties.counterparties.map((cp) => (
                <div key={cp.party} style={{ padding: 12, background: "var(--color-parchment)", borderRadius: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--color-lichen-gray)", textTransform: "uppercase" }}>Counterparty</span>
                  <div style={{ fontSize: 15, fontWeight: 600, margin: "2px 0" }}>{cp.party}</div>
                  <span style={{ fontSize: 12, color: cp.accepted ? "green" : "orange" }}>
                    {cp.accepted ? "✓ Accepted" : "⏳ Awaiting Acceptance"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: CIP-56 Leg Allocations */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, margin: "0 0 16px", fontWeight: 600 }}>2. CIP-56 Leg Allocations</h3>
            <div className="table-responsive">
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-mist)", textAlign: "left" }}>
                    <th style={{ padding: "8px 12px" }}>Leg</th>
                    <th style={{ padding: "8px 12px" }}>Instrument</th>
                    <th style={{ padding: "8px 12px" }}>Amount</th>
                    <th style={{ padding: "8px 12px" }}>Provider → Receiver</th>
                    <th style={{ padding: "8px 12px" }}>Allocation Status</th>
                    <th style={{ padding: "8px 12px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {readiness.allocatedLegs.map((leg) => (
                    <tr key={leg.legId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{leg.legId}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.instrumentId}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.amount}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.provider} → {leg.receiver}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 12, background: "var(--color-meadow)", color: "var(--color-deep-forest)", fontSize: 11 }}>
                          ✓ Matched on-chain
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        {readiness.status !== "settled" && (
                          <button
                            className="btn"
                            style={{ fontSize: 11, padding: "4px 8px" }}
                            onClick={() => handleWithdrawLeg(leg.legId, leg.provider)}
                            disabled={busy}
                          >
                            Withdraw (FR-10)
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {readiness.outstandingLegs.map((leg) => (
                    <tr key={leg.legId} style={{ borderBottom: "1px solid #f0f0f0", opacity: 0.75 }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600 }}>{leg.legId}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.instrumentId}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.amount}</td>
                      <td style={{ padding: "10px 12px" }}>{leg.provider} → {leg.receiver}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 12, background: "var(--color-buttercream)", color: "#8a6d3b", fontSize: 11 }}>
                          ⏳ Unallocated
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--color-lichen-gray)" }}>
          No compositions active. Click <strong>+ Propose New Trade</strong> above to create one.
        </div>
      )}
    </div>
  );
}
