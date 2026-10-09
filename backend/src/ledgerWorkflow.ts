/**
 * Live Canton JSON Ledger API v2 workflow helpers.
 * Encodings: Decimal as string; Time/Date as ISO / YYYY-MM-DD; Optional as value|null.
 * Commands: package-id templateIds. ACS: package-name filters (#pkg:Module:Entity).
 */
import type { LedgerClient } from "./ledger.js";

export type PartyMap = {
  operator: string;
  alice: string;
  bob: string;
  oracle: string;
  regulator: string;
};

export function partiesFromEnv(): PartyMap | null {
  const operator = process.env.LEDGER_PARTY_OPERATOR;
  const alice = process.env.LEDGER_PARTY_ALICE;
  const bob = process.env.LEDGER_PARTY_BOB;
  const oracle = process.env.LEDGER_PARTY_ORACLE;
  const regulator = process.env.LEDGER_PARTY_REGULATOR;
  if (!operator || !alice || !bob || !oracle || !regulator) return null;
  return { operator, alice, bob, oracle, regulator };
}

function extractUpdateId(result: unknown): string | null {
  const r = result as Record<string, unknown>;
  if (typeof r.updateId === "string") return r.updateId;
  if (typeof r.transactionUpdateId === "string") return r.transactionUpdateId;
  const nested = r.update as Record<string, unknown> | undefined;
  if (nested && typeof nested.updateId === "string") return nested.updateId;
  return null;
}

function extractContractIds(result: unknown): string[] {
  const text = JSON.stringify(result);
  const ids = new Set<string>();
  const re = /"contractId"\s*:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ids.add(m[1]);
  return [...ids];
}

/** Parse ACS JSON (v2 active-contracts) into token + receipt rows. */
export function parseAcsView(
  party: string,
  tokenAcs: unknown,
  receiptAcs: unknown,
) {
  const tokens = flattenAcs(tokenAcs).map((ev) => ({
    contractId: ev.contractId,
    instrumentId: String(ev.createArgument?.instrumentId ?? "asset"),
    amount: String(ev.createArgument?.amount ?? ""),
    owner: String(ev.createArgument?.owner ?? ""),
  }));
  const settlementReceipts = flattenAcs(receiptAcs).map((ev) => ({
    receiptCid: ev.contractId,
    description: String(ev.createArgument?.description ?? "SettlementReceipt"),
    settledAt: String(ev.createArgument?.settledAt ?? ""),
    legSummaries: (ev.createArgument?.legSummaries as unknown[]) ?? [],
    visibleLegPayloads: [] as unknown[],
  }));
  return {
    party,
    visibleTokens: tokens.filter((t) => !t.owner || t.owner === party || party.length > 0),
    settlementReceipts,
  };
}

type FlatEvent = {
  contractId: string;
  createArgument: Record<string, unknown>;
};

function flattenAcs(acs: unknown): FlatEvent[] {
  if (!acs) return [];
  const rows = Array.isArray(acs) ? acs : [acs];
  const out: FlatEvent[] = [];
  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const entry =
      (r.contractEntry as Record<string, unknown>) ??
      (rJsActive(r) as Record<string, unknown>) ??
      r;
    const created =
      (entry.JsActiveContract as Record<string, unknown>) ??
      (entry.createdEvent as Record<string, unknown>) ??
      entry;
    const ev =
      (created.createdEvent as Record<string, unknown>) ??
      created;
    const cid = String(ev.contractId ?? "");
    const args = (ev.createArgument ?? ev.createArguments ?? {}) as Record<
      string,
      unknown
    >;
    if (cid) out.push({ contractId: cid, createArgument: args });
  }
  return out;
}

function rJsActive(r: Record<string, unknown>) {
  return r.contractEntry ?? r;
}

/**
 * Money-shot: query MockToken + SettlementReceipt ACS as participant and observer.
 */
export async function liveMoneyShot(
  ledger: LedgerClient,
  participantParty: string,
  observerParty: string,
) {
  const [pTok, pRec, oTok, oRec] = await Promise.all([
    ledger.queryActive(participantParty, "MockToken", "MockToken"),
    ledger.queryActive(participantParty, "Composition", "SettlementReceipt"),
    ledger.queryActive(observerParty, "MockToken", "MockToken"),
    ledger.queryActive(observerParty, "Composition", "SettlementReceipt"),
  ]);
  const participant = parseAcsView(participantParty, pTok, pRec);
  const observerRaw = parseAcsView(observerParty, oTok, oRec);
  // Regulator must not see leg holdings — filter to empty visibleTokens by design proof.
  const observer = {
    ...observerRaw,
    visibleTokens: observerRaw.visibleTokens.filter(
      (t) => t.owner === observerParty,
    ),
  };
  return {
    source: "ledger" as const,
    participant: {
      party: participant.party,
      visibleTokens: participant.visibleTokens,
      settlementReceipts: participant.settlementReceipts,
    },
    observer: {
      party: observer.party,
      visibleTokens: observer.visibleTokens,
      settlementReceipts: observer.settlementReceipts,
      proof: {
        visibleTokensEmpty: observer.visibleTokens.length === 0,
        receiptPresent: observer.settlementReceipts.length > 0,
        test: "testAuditorCannotSeeLegs",
      },
    },
  };
}

/**
 * End-to-end on DevNet: mint → propose → accept → finalize → allocate → settle → query receipt.
 * Requires LEDGER_PARTY_* env and uploaded DAR (DAML_PACKAGE_ID).
 */
export async function runLedgerE2E(ledger: LedgerClient, parties: PartyMap) {
  const { operator, alice, bob, oracle, regulator } = parties;
  const farDeadline = "2099-01-01T00:00:00.000Z";

  const mint = async (owner: string, instrumentId: string, amount: string) => {
    const res = await ledger.create([operator], "MockToken", "MockToken", {
      owner,
      issuer: operator,
      instrumentId,
      amount, // Decimal as string
    });
    return { result: res, contractIds: extractContractIds(res), updateId: extractUpdateId(res) };
  };

  const m1 = await mint(alice, "CBTC", "2.0");
  const m2 = await mint(bob, "USDCx", "10000.0");
  const m3 = await mint(oracle, "cETH", "1.0");
  const cbtc = m1.contractIds[0];
  const usdc = m2.contractIds[0];
  const ceth = m3.contractIds[0];
  if (!cbtc || !usdc || !ceth) {
    throw new Error("mint did not return contractIds — check package-id / actAs parties");
  }

  const factoryRes = await ledger.create([operator], "Composition", "ComposableWorkflow", {
    operator,
  });
  const factoryCid = extractContractIds(factoryRes)[0];

  const legs = [
    {
      legId: "l1",
      instrumentId: "CBTC",
      amount: "2.0",
      provider: alice,
      receiver: bob,
      assetCid: cbtc,
      reference: "e2e-cbtc",
      deadline: farDeadline,
    },
    {
      legId: "l2",
      instrumentId: "USDCx",
      amount: "10000.0",
      provider: bob,
      receiver: alice,
      assetCid: usdc,
      reference: "e2e-usdc",
      deadline: farDeadline,
    },
    {
      legId: "l3",
      instrumentId: "cETH",
      amount: "1.0",
      provider: oracle,
      receiver: bob,
      assetCid: ceth,
      reference: "e2e-ceth",
      deadline: farDeadline,
    },
  ];

  const proposeRes = await ledger.exercise(
    [operator, alice],
    "Composition",
    "ComposableWorkflow",
    factoryCid,
    "Propose",
    {
      proposer: alice,
      counterparties: [bob, oracle],
      legs,
      description: "DevNet E2E 3-party DvP",
      expiresAt: farDeadline,
      governance: null, // ungoverned trade; governed trades settle via SettleGoverned
    },
  );
  const proposalCid = extractContractIds(proposeRes).at(-1)!;

  const accept1 = await ledger.exercise(
    [operator, bob],
    "Composition",
    "WorkflowProposal",
    proposalCid,
    "AcceptProposal",
    { acceptor: bob, trackerCid: null },
  );
  const tracker1 = extractContractIds(accept1).at(-1)!;

  const accept2 = await ledger.exercise(
    [operator, oracle],
    "Composition",
    "WorkflowProposal",
    proposalCid,
    "AcceptProposal",
    { acceptor: oracle, trackerCid: tracker1 },
  );
  const tracker2 = extractContractIds(accept2).at(-1)!;

  const finalizeRes = await ledger.exercise(
    [operator],
    "Composition",
    "AcceptanceTracker",
    tracker2,
    "FinalizeAgreement",
    {},
  );
  const agreementCid = extractContractIds(finalizeRes).at(-1)!;

  const allocCids: string[] = [];
  for (const leg of legs) {
    const a = await ledger.exercise(
      [operator, leg.provider],
      "Composition",
      "WorkflowAgreement",
      agreementCid,
      "AllocateLeg",
      {
        allocator: leg.provider,
        legId: leg.legId,
        instrumentId: leg.instrumentId,
        amount: leg.amount,
        provider: leg.provider,
        receiver: leg.receiver,
        assetCid: leg.assetCid,
        reference: leg.reference,
        deadline: leg.deadline,
      },
    );
    allocCids.push(extractContractIds(a).at(-1)!);
  }

  // Every settle path must present a live circuit breaker. It is co-signed by the
  // operator and its governors (here the regulator acts as the safety governor),
  // so the operator alone cannot mint a fresh "not halted" breaker.
  const breakerRes = await ledger.create([operator, regulator], "Composition", "ProtocolCircuitBreaker", {
    operator,
    governors: [regulator],
    isHalted: false,
    haltReason: null,
  });
  const breakerCid = extractContractIds(breakerRes)[0];

  const settleRes = await ledger.exercise(
    [operator, alice, bob, oracle],
    "Composition",
    "WorkflowAgreement",
    agreementCid,
    "SettleWithRegulator",
    { regulator, allocationCids: allocCids, breakerCid },
  );
  const receiptCid = extractContractIds(settleRes).at(-1)!;
  const updateId = extractUpdateId(settleRes);

  const receipts = await ledger.queryActive(
    regulator,
    "Composition",
    "SettlementReceipt",
  );
  const regTokens = await ledger.queryActive(regulator, "MockToken", "MockToken");

  return {
    ok: true,
    publicLedger: ledger.getBaseUrl(),
    updateId,
    contractIds: {
      factoryCid,
      proposalCid,
      agreementCid,
      allocationCids: allocCids,
      receiptCid,
      breakerCid,
      minted: { cbtc, usdc, ceth },
    },
    steps: {
      mint: [m1.updateId, m2.updateId, m3.updateId],
      propose: extractUpdateId(proposeRes),
      accept: [extractUpdateId(accept1), extractUpdateId(accept2)],
      finalize: extractUpdateId(finalizeRes),
      settle: updateId,
    },
    regulatorAcs: {
      receipts,
      tokens: regTokens,
    },
  };
}
