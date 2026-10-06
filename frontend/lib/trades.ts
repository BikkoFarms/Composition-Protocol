"use client";

/**
 * Trade catalogue shared by the desks (settle, exporter, readiness, BitSafe).
 * Loaded from GET /compositions/templates so the backend stays the source of truth.
 */

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export type TemplateLeg = {
  legId: string;
  label: string;
  instrumentId: string;
  amount: string;
  provider: string;
  receiver: string;
};

export type TradeTemplate = {
  id: string;
  name: string;
  commodity: string;
  region: string;
  oracleSymbol: string;
  summary: string;
  description: string;
  counterparties: string[];
  legs: TemplateLeg[];
};

/** Friendly role names for the fixed demo parties. */
export const ROLE_NAMES: Record<string, string> = {
  Alice: "Exporter (Alice)",
  Bob: "Lender (Bob)",
  Oracle: "Inspector (Oracle)",
  Operator: "Operator",
  Regulator: "Auditor",
};

export function roleName(party: string): string {
  return ROLE_NAMES[party] ?? party;
}

export function formatAmount(amount: string): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return amount;
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/** Turn raw protocol errors into plain-language messages. */
export function friendlyError(raw: string): string {
  const msg = raw.replace(/^Error:\s*/, "");
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return "Can't reach the settlement API. Check that the backend is running (npm run dev:api) and try again.";
  }
  if (/circuit breaker/i.test(msg)) {
    return "Settlement is paused by the emergency circuit breaker. Resume it from Mission control, then retry.";
  }
  if (/not fully accepted|accept all counterparties first/i.test(msg)) {
    return "Every counterparty must sign the trade before legs can be locked or settled.";
  }
  if (/already allocated/i.test(msg)) {
    return "That leg is already locked. Move on to the next one.";
  }
  if (/expected \d+ allocations, got \d+/i.test(msg)) {
    return "Some legs are still unlocked. Lock every leg, then settle.";
  }
  if (/atomic settle reverted/i.test(msg)) {
    return "Settlement reverted: one leg failed, so no leg moved. Every party still holds its original assets.";
  }
  return msg;
}

export function useTradeTemplates() {
  const [templates, setTemplates] = useState<TradeTemplate[]>([]);
  const [defaultId, setDefaultId] = useState("cocoa");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ defaultTemplateId: string; templates: TradeTemplate[] }>(
      "/compositions/templates",
    )
      .then((res) => {
        setTemplates(res.templates);
        setDefaultId(res.defaultTemplateId);
      })
      .catch((e) => setError(friendlyError(String((e as Error).message))));
  }, []);

  return { templates, defaultId, error };
}
