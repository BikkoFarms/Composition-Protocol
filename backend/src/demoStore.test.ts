import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { DemoStore } from "./demoStore.js";
import { TRADE_TEMPLATES } from "./tradeTemplates.js";

describe("Settleflow demo gates", () => {
  let store: DemoStore;

  beforeEach(() => {
    store = new DemoStore();
  });

  it("testAtomicSwap — 2+ legs settle all-or-nothing", () => {
    const result = store.runFullDemo();
    assert.equal(result.error, null);
    assert.equal(result.composition.status, "settled");
    assert.equal(result.composition.legSummaries?.length, 3);
    assert.ok(result.composition.receiptCid);
    // Alice receives USDCx; Bob receives CBTC + cETH
    const alice = store.listTokens("Alice");
    const bob = store.listTokens("Bob");
    assert.ok(alice.some((t) => t.instrumentId === "USDCx"));
    assert.ok(bob.some((t) => t.instrumentId === "CBTC"));
  });

  it("testAtomicRevert — failed leg leaves no half-state", () => {
    const beforeBob = store.listTokens("Bob").map((t) => ({
      id: t.contractId,
      owner: t.owner,
      instrumentId: t.instrumentId,
    }));
    const result = store.runFullDemo({ forceFail: true });
    assert.ok(result.error?.includes("reverted"));
    assert.equal(result.composition.status, "reverted");
    const afterBob = store.listTokens("Bob");
    // CBTC still with Bob (provider) — transfer did not partially apply
    const bobCbtc = afterBob.find((t) => t.instrumentId === "CBTC");
    assert.ok(bobCbtc);
    assert.equal(bobCbtc?.owner, "Bob");
    assert.equal(store.metrics.compositionsReverted >= 1, true);
    void beforeBob;
  });

  it("testAuditorCannotSeeLegs — regulator visibleTokens [] + receipt", () => {
    store.runFullDemo();
    const observer = store.partyView("Regulator");
    assert.deepEqual(observer.visibleTokens, []);
    assert.ok(observer.settlementReceipts.length >= 1);
    assert.deepEqual(observer.settlementReceipts[0].visibleLegPayloads, []);
    assert.ok(
      observer.compositions.every((c) => (c as { legs: unknown[] }).legs.length === 0),
    );
  });

  it("allocation mismatch rejected — no half-state", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    const leg = store.require(c.id).legs.find((l) => l.legId === "cash")!;
    assert.throws(
      () =>
        store.allocate(c.id, {
          ...leg,
          amount: "999999.0",
        }),
      /allocation match failed: amount mismatch on leg cash/,
    );
    assert.equal(store.require(c.id).allocations.length, 0);
    assert.equal(store.require(c.id).status, "accepted");
  });

  it("allocate → settle — commits + ready_to_settle gate", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    // Explicit per-leg allocate (desk /demo path)
    for (const leg of store.require(c.id).legs) {
      const { commit } = store.allocate(c.id, { ...leg });
      assert.ok(commit.updateId.startsWith("upd-"));
      assert.equal(commit.choice, "AllocateLeg");
    }
    assert.equal(store.require(c.id).status, "ready_to_settle");
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
    assert.ok(settled.commits.some((x) => x.choice === "AllocateLeg"));
  });

  it("settle auto-allocates matched legs when desk skips explicit allocate", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    assert.equal(store.require(c.id).allocations.length, 0);
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
    assert.equal(settled.allocations.length, 3);
    assert.ok(settled.commits.some((x) => x.choice === "AllocateLeg"));
  });

  it("R-GOV-1 below threshold rejected", () => {
    const c = store.proposeTradeFinance({ requireGovernance: true });
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    const opened = store.settle(c.id);
    assert.equal(opened.status, "awaiting_governance");
    assert.ok(opened.governanceCid);
    store.approveGovernance(opened.governanceCid!, "Gov1");
    assert.throws(
      () => store.executeGovernance(opened.governanceCid!),
      /below threshold/,
    );
    assert.equal(store.require(c.id).status, "awaiting_governance");
  });

  it("R-GOV-1 at threshold succeeds", () => {
    const c = store.proposeTradeFinance({ requireGovernance: true });
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    const opened = store.settle(c.id);
    store.approveGovernance(opened.governanceCid!, "Gov1");
    store.approveGovernance(opened.governanceCid!, "Gov2");
    const settled = store.executeGovernance(opened.governanceCid!);
    assert.equal(settled.status, "settled");
    assert.equal(store.metrics.governedSettlements, 1);
  });

  it("Judge Metrics — calculates avgLegsPerComposition, successRate, revertRate", () => {
    // 2 happy path deals (3 legs each)
    store.runFullDemo();
    store.runFullDemo();
    // 1 forced revert deal
    store.runFullDemo({ forceFail: true });

    const m = store.metrics;
    assert.equal(m.compositionsSettled, 2);
    assert.equal(m.compositionsReverted, 1);
    assert.equal(m.totalAttempted, 3);
    assert.equal(m.legsSettled, 6);
    assert.equal(m.avgLegsPerComposition, 3.0);
    assert.equal(m.successRate, 66.7);
    assert.equal(m.revertRate, 33.3);
    assert.ok(m.recentEvents.length >= 3);
    assert.equal(m.unexpectedFailures, 0);
  });

  it("Proposer Cancellation — allows clean withdrawal before settlement", () => {
    const c = store.proposeTradeFinance();
    assert.equal(c.status, "proposed");
    const cancelled = store.cancel(c.id, "Alice");
    assert.equal(cancelled.status, "cancelled");
    assert.throws(() => store.settle(c.id), /not fully accepted/);
  });

  it("Emergency Circuit Breaker — blocks settlement during halt and resumes", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    // Trigger emergency halt
    store.toggleCircuitBreaker("Operator", "Suspected Oracle Anomaly");
    assert.throws(() => store.settle(c.id), /circuit breaker is active/);

    // Resume protocol
    store.toggleCircuitBreaker("Operator");
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
  });

  it("Institutional Emergency Veto — named governor can abort open governed deal", () => {
    const c = store.proposeTradeFinance({ requireGovernance: true });
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    const opened = store.settle(c.id);
    const govId = opened.governanceCid!;
    const vetoed = store.vetoGovernance(govId, "Gov1", "Collateral valuation anomaly");
    assert.equal(vetoed.status, "rejected");
    assert.equal(vetoed.vetoReason, "Collateral valuation anomaly");
    assert.equal(store.require(c.id).status, "reverted");
  });

  it("Cryptographic Deal Hash & Valuation — enforces sha256 digest and LTV ratio", () => {
    const c = store.proposeTradeFinance();
    assert.ok(c.dealHash);
    assert.equal(c.dealHash.length, 64); // SHA-256 hex string
    assert.ok(c.collateralRatio);
    assert.ok(c.ltvPercent);
    assert.ok(c.legs[0].cantonDomain);
  });

  it("Operator Treasury Direct Minting — issues new composable assets to party ACS", () => {
    const minted = store.mint("Alice", "cETH", "15.5");
    assert.equal(minted.owner, "Alice");
    assert.equal(minted.instrumentId, "cETH");
    assert.equal(minted.amount, "15.5");
    const aliceTokens = store.listTokens("Alice");
    assert.ok(aliceTokens.some((t) => t.instrumentId === "cETH" && t.amount === "15.5"));
  });

  it("Failure Path: Expiry — resolves stalled or timed-out proposals cleanly", () => {
    // Proposal with simulated expiry
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const c = store.proposeTradeFinance();
    c.expiresAt = pastDate;
    assert.equal(c.status, "proposed");

    const expired = store.expire(c.id, "Operator", new Date());
    assert.equal(expired.status, "expired");
    assert.throws(() => store.settle(c.id), /not fully accepted/);
  });

  it("Failure Path: Rejection — counterparty rejection cleanly resolves without half-state", () => {
    const c = store.proposeTradeFinance();
    assert.equal(c.status, "proposed");

    const rejected = store.reject(c.id, "Bob", "Margin requirements unmet");
    assert.equal(rejected.status, "rejected");
    assert.equal(rejected.rejectionReason, "Margin requirements unmet");
    assert.throws(() => store.settle(c.id), /not fully accepted/);
  });

  it("Failure Path: Partial completion — maintains valid state without leaking or premature execution", () => {
    const c = store.proposeTradeFinance();
    // Accept only Party B (Bob), leaving Party C (Oracle) pending
    const partial = store.accept(c.id, "Bob");
    assert.equal(partial.status, "partially_accepted");
    assert.equal(partial.accepted.length, 1);
    assert.equal(partial.agreementCid, null);

    // Premature settle attempt MUST reject
    assert.throws(() => store.settle(c.id), /not fully accepted/);
  });

  it("Disclosed Contract Handling — attaches and preserves explicit contract disclosures", () => {
    const cbtc = store.listTokens("Alice").find((t) => t.instrumentId === "CBTC")!;
    const c = store.propose({
      proposer: "Alice",
      counterparties: ["Bob"],
      description: "Disclosed contract test",
      disclosedContracts: [
        {
          templateId: "MockToken:MockToken",
          contractId: cbtc.contractId,
          createdEventBlob: "blob-0x123abc",
          payload: { owner: "Alice", instrumentId: "CBTC", amount: cbtc.amount },
        },
      ],
      legs: [
        {
          legId: "cbtc-leg",
          instrumentId: "CBTC",
          amount: "1.0",
          provider: "Alice",
          receiver: "Bob",
          assetCid: cbtc.contractId,
        },
        {
          legId: "usdc-leg",
          instrumentId: "USDCx",
          amount: "1000.0",
          provider: "Bob",
          receiver: "Alice",
          assetCid: store.listTokens("Bob").find((t) => t.instrumentId === "USDCx")!.contractId,
        },
      ],
    });
    assert.ok(c.disclosedContracts);
    assert.equal(c.disclosedContracts?.length, 1);
    assert.equal(c.disclosedContracts?.[0].contractId, cbtc.contractId);
  });

  it("Reuse Verification — executes multiple distinct 3-party DvP configurations without modifying package logic", () => {
    // Run 1: Standard Coffee/USDCx/Attest trade finance
    const t1 = store.mint("Alice", "COFFEE", "10.0");
    const t2 = store.mint("Bob", "USDCx", "41200.0");
    const t3 = store.mint("Oracle", "ATTEST", "1.0");

    const deal1 = store.propose({
      proposer: "Alice",
      counterparties: ["Bob", "Oracle"],
      description: "East African Coffee Export DvP",
      legs: [
        { legId: "l1", instrumentId: "COFFEE", amount: "10.0", provider: "Alice", receiver: "Bob", assetCid: t1.contractId },
        { legId: "l2", instrumentId: "USDCx", amount: "41200.0", provider: "Bob", receiver: "Alice", assetCid: t2.contractId },
        { legId: "l3", instrumentId: "ATTEST", amount: "1.0", provider: "Oracle", receiver: "Bob", assetCid: t3.contractId },
      ],
    });
    store.accept(deal1.id, "Bob");
    store.accept(deal1.id, "Oracle");
    store.allocateAll(deal1.id);
    const settled1 = store.settle(deal1.id);
    assert.equal(settled1.status, "settled");

    // Run 2: Re-use exact same template package with completely different asset & topology (Cashew / cETH DvP)
    const t4 = store.mint("Alice", "CASHEW", "25.0");
    const t5 = store.mint("Bob", "cETH", "12.0");
    const t6 = store.mint("Oracle", "ATTEST", "1.0");

    const deal2 = store.propose({
      proposer: "Alice",
      counterparties: ["Bob", "Oracle"],
      description: "West African Cashew Export DvP",
      legs: [
        { legId: "l1", instrumentId: "CASHEW", amount: "25.0", provider: "Alice", receiver: "Bob", assetCid: t4.contractId },
        { legId: "l2", instrumentId: "cETH", amount: "12.0", provider: "Bob", receiver: "Alice", assetCid: t5.contractId },
        { legId: "l3", instrumentId: "ATTEST", amount: "1.0", provider: "Oracle", receiver: "Bob", assetCid: t6.contractId },
      ],
    });
    store.accept(deal2.id, "Bob");
    store.accept(deal2.id, "Oracle");
    store.allocateAll(deal2.id);
    const settled2 = store.settle(deal2.id);
    assert.equal(settled2.status, "settled");
    assert.notEqual(settled1.id, settled2.id);
  });

  // ============================================================
  // SRS §12 Core Acceptance Tests
  // ============================================================
  it("SRS §12: testWorkflowProposal — confirms proposal creation and workflow initialization", () => {
    const c = store.proposeTradeFinance();
    assert.equal(c.status, "proposed");
    assert.equal(c.legs.length, 3);
    assert.ok(c.proposalCid);
    assert.ok(c.dealHash);
  });

  it("SRS §12: testWorkflowAcceptance — confirms acceptance and state progression", () => {
    const c = store.proposeTradeFinance();
    assert.equal(c.status, "proposed");
    store.accept(c.id, "Bob");
    assert.equal(store.require(c.id).status, "partially_accepted");
    store.accept(c.id, "Oracle");
    assert.equal(store.require(c.id).status, "accepted");
    assert.ok(store.require(c.id).agreementCid);
  });

  it("SRS §12: testWorkflowExpiryOrCancel — confirms stalled workflows resolve cleanly", () => {
    // 1. Proposer cancel path
    const c1 = store.proposeTradeFinance();
    const cancelled = store.cancel(c1.id, "Alice");
    assert.equal(cancelled.status, "cancelled");

    // 2. Timeout expiry path
    const c2 = store.proposeTradeFinance();
    c2.expiresAt = new Date(Date.now() - 1000).toISOString();
    const expired = store.expire(c2.id, "Operator", new Date());
    assert.equal(expired.status, "expired");
  });

  it("SRS §12: testWorkflowSettlement — confirms settlement completes end to end", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
    assert.ok(settled.receiptCid);
    assert.equal(settled.legSummaries?.length, 3);
  });

  it("FR-8: demo assets issuance produces valid CIP-56 holdings", () => {
    const tAsset = store.mint("Alice", "CBTC", "5.0");
    const pToken = store.mint("Bob", "USDCx", "25000.0");
    assert.equal(tAsset.owner, "Alice");
    assert.equal(tAsset.instrumentId, "CBTC");
    assert.equal(pToken.owner, "Bob");
    assert.equal(pToken.instrumentId, "USDCx");
    assert.ok(store.listTokens("Alice").some((t) => t.contractId === tAsset.contractId));
    assert.ok(store.listTokens("Bob").some((t) => t.contractId === pToken.contractId));
  });

  it("FR-9: audit trail provides per-party scoped history", () => {
    store.runFullDemo();
    const aliceView = store.partyView("Alice");
    const bobView = store.partyView("Bob");
    const regulatorView = store.partyView("Regulator");

    assert.ok(aliceView.auditEvents && aliceView.auditEvents.length > 0);
    assert.ok(bobView.auditEvents && bobView.auditEvents.length > 0);
    assert.ok(regulatorView.auditEvents && regulatorView.auditEvents.length > 0);
    // Regulator sees settlement receipts without token payloads
    assert.deepEqual(regulatorView.visibleTokens, []);
    assert.ok(regulatorView.settlementReceipts.length > 0);
  });

  it("FR-10: failure path — wrong executor rejected", () => {
    const c = store.proposeTradeFinance();
    c.executor = "Operator";
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    // Calling settle with wrong executor throws error
    assert.throws(
      () => store.settle(c.id, true, "Bob"),
      /settlement rejected: wrong executor \(caller Bob is not designated executor Operator\)/,
    );
    assert.equal(store.require(c.id).status, "ready_to_settle");
    // Valid executor succeeds
    const settled = store.settle(c.id, true, "Operator");
    assert.equal(settled.status, "settled");
  });

  it("FR-10: failure path — cancelled trade releases locked allocations", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    assert.equal(store.require(c.id).allocations.length, 3);
    assert.equal(store.require(c.id).status, "ready_to_settle");

    const cancelled = store.cancel(c.id, "Alice");
    assert.equal(cancelled.status, "cancelled");
    // Allocations released back to parties
    assert.equal(cancelled.allocations.length, 0);
  });

  it("FR-10 & FR-11: partial allocation blocks settlement until all legs ready", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    // Allocate only 1 of 3 legs
    const leg0 = c.legs[0];
    store.allocate(c.id, { ...leg0 });
    assert.equal(store.require(c.id).status, "allocating");
    assert.equal(store.require(c.id).allocations.length, 1);

    // Attempting to settle during partial allocation throws
    assert.throws(
      () => store.settle(c.id),
      /expected 3 allocations, got 1/,
    );
    assert.equal(store.require(c.id).status, "allocating");
  });

  it("FR-10: failure path — withdrawn leg blocks settlement until re-allocated", () => {
    const c = store.proposeTradeFinance();
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);
    assert.equal(store.require(c.id).status, "ready_to_settle");

    // Oracle withdraws the sponsor leg
    const { withdrawnAllocation } = store.withdrawLeg(c.id, "sponsor", "Oracle");
    assert.equal(withdrawnAllocation.legId, "sponsor");
    assert.equal(store.require(c.id).status, "allocating");
    assert.equal(store.require(c.id).allocations.length, 2);

    // Settlement must reject because a leg was withdrawn
    assert.throws(
      () => store.settle(c.id),
      /expected 3 allocations, got 2/,
    );

    // Re-allocating the withdrawn leg restores readiness and allows atomic settlement
    const sponsorLeg = c.legs.find((l) => l.legId === "sponsor")!;
    store.allocate(c.id, { ...sponsorLeg });
    assert.equal(store.require(c.id).status, "ready_to_settle");
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
  });

  it("FR-12: allocate-by and settle-by deadlines prevent stranded trades", () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const future = new Date(Date.now() + 100_000).toISOString();
    const aliceTok = store.listTokens("Alice").find((t) => t.instrumentId === "CBTC")!;
    const bobTok = store.listTokens("Bob").find((t) => t.instrumentId === "USDCx")!;

    // Past allocateBy deadline
    const expiredAlloc = store.propose({
      proposer: "Alice",
      counterparties: ["Bob"],
      description: "Expired allocation test",
      allocateBy: past,
      legs: [
        {
          legId: "leg1",
          instrumentId: "CBTC",
          amount: aliceTok.amount,
          provider: "Alice",
          receiver: "Bob",
          assetCid: aliceTok.contractId,
        },
        {
          legId: "leg2",
          instrumentId: "USDCx",
          amount: bobTok.amount,
          provider: "Bob",
          receiver: "Alice",
          assetCid: bobTok.contractId,
        },
      ],
    });
    store.accept(expiredAlloc.id, "Bob");
    assert.throws(
      () => store.allocate(expiredAlloc.id, { ...expiredAlloc.legs[0] }),
      /allocate-by deadline passed/,
    );
    // Expiry can be cleanly triggered to release trade
    const expired = store.expire(expiredAlloc.id);
    assert.equal(expired.status, "expired");

    // Past settleBy deadline
    const expiredSettle = store.propose({
      proposer: "Alice",
      counterparties: ["Bob"],
      description: "Expired settlement test",
      allocateBy: future,
      settleBy: past,
      legs: [
        {
          legId: "leg1",
          instrumentId: "CBTC",
          amount: aliceTok.amount,
          provider: "Alice",
          receiver: "Bob",
          assetCid: aliceTok.contractId,
        },
        {
          legId: "leg2",
          instrumentId: "USDCx",
          amount: bobTok.amount,
          provider: "Bob",
          receiver: "Alice",
          assetCid: bobTok.contractId,
        },
      ],
    });
    store.accept(expiredSettle.id, "Bob");
    store.allocate(expiredSettle.id, { ...expiredSettle.legs[0] });
    store.allocate(expiredSettle.id, { ...expiredSettle.legs[1] });
    assert.throws(
      () => store.settle(expiredSettle.id),
      /settle-by deadline passed/,
    );
  });

  it("FR-13: permissioning matrix enforces stage-based execute and cancel rights", () => {
    const c = store.proposeTradeFinance();
    // In proposed stage: counterparty Bob cannot cancel yet (only proposer Alice or Operator)
    assert.throws(
      () => store.cancel(c.id, "Bob"),
      /stage permission: only proposer Alice or Operator can cancel proposal/,
    );
    // Unrelated party cannot cancel
    assert.throws(
      () => store.cancel(c.id, "Gov1"),
      /stage permission: only proposer Alice or Operator can cancel proposal/,
    );

    // Once accepted: counterparties can cancel
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    store.allocateAll(c.id);

    // Settled stage: cannot be cancelled
    const settled = store.settle(c.id);
    assert.equal(settled.status, "settled");
    assert.throws(
      () => store.cancel(c.id, "Alice"),
      /cannot cancel settled composition/,
    );
  });

  it("FR-14: privacy rules enforce strict isolation between third parties and counterparties", () => {
    store.runFullDemo();
    // Counterparty Bob sees his own holdings and settlement receipts
    const bobView = store.partyView("Bob");
    assert.ok(bobView.visibleTokens.length > 0);
    assert.ok(bobView.compositions.length > 0);

    // Regulator sees settlement receipts only with zero tokens
    const regulatorView = store.partyView("Regulator");
    assert.deepEqual(regulatorView.visibleTokens, []);
    assert.ok(regulatorView.settlementReceipts.length > 0);
    assert.deepEqual(regulatorView.settlementReceipts[0].visibleLegPayloads, []);

    // Unconnected governor Gov3 (not in governance for this deal) sees 0 uninvited compositions
    const govView = store.partyView("Gov3");
    assert.deepEqual(govView.compositions, []);
    assert.deepEqual(govView.visibleTokens, []);
  });

  it("FR-16: settlement backend adapter interface abstracts lifecycle operations", async () => {
    const { getSettlementBackendAdapter } = await import("./adapter.js");
    const adapter = getSettlementBackendAdapter(store);
    assert.equal(adapter.mode, "demo");

    const aliceTok = store.listTokens("Alice").find((t) => t.instrumentId === "CBTC")!;
    const bobTok = store.listTokens("Bob").find((t) => t.instrumentId === "USDCx")!;

    const comp = await adapter.propose({
      proposer: "Alice",
      counterparties: ["Bob"],
      description: "Adapter abstraction test",
      legs: [
        {
          legId: "legA",
          instrumentId: "CBTC",
          amount: aliceTok.amount,
          provider: "Alice",
          receiver: "Bob",
          assetCid: aliceTok.contractId,
        },
        {
          legId: "legB",
          instrumentId: "USDCx",
          amount: bobTok.amount,
          provider: "Bob",
          receiver: "Alice",
          assetCid: bobTok.contractId,
        },
      ],
    });
    assert.ok(comp.id);
    const accepted = await adapter.accept(comp.id, "Bob");
    assert.equal(accepted.status, "accepted");
    const readiness = await adapter.getReadiness(comp.id);
    assert.equal(readiness.isReady, false);
    assert.equal(readiness.totalLegs, 2);
  });

  it("FR-19: policy hooks enforce eligibility and limits", () => {
    // Ineligible/blocked party policy violation
    assert.throws(
      () =>
        store.propose({
          proposer: "Alice",
          counterparties: ["Bob"],
          description: "Policy blocked test",
          policyConfig: {
            blockedParties: ["Bob"],
          },
          legs: [
            {
              legId: "l1",
              instrumentId: "CBTC",
              amount: "1.0",
              provider: "Alice",
              receiver: "Bob",
              assetCid: store.listTokens("Alice")[0].contractId,
            },
            {
              legId: "l2",
              instrumentId: "USDCx",
              amount: "100.0",
              provider: "Bob",
              receiver: "Alice",
              assetCid: store.listTokens("Bob")[0].contractId,
            },
          ],
        }),
      /policy violation: counterparty Bob is ineligible/,
    );

    // Max transaction amount limit policy violation
    assert.throws(
      () =>
        store.propose({
          proposer: "Alice",
          counterparties: ["Bob"],
          description: "Policy limit test",
          policyConfig: {
            maxTransactionAmount: 1000,
          },
          legs: [
            {
              legId: "l1",
              instrumentId: "CBTC",
              amount: "1.0",
              provider: "Alice",
              receiver: "Bob",
              assetCid: store.listTokens("Alice")[0].contractId,
            },
            {
              legId: "l2",
              instrumentId: "USDCx",
              amount: "5000.0", // exceeds 1000 limit
              provider: "Bob",
              receiver: "Alice",
              assetCid: store.listTokens("Bob")[0].contractId,
            },
          ],
        }),
      /policy violation: leg l2 amount 5000.0 exceeds max transaction limit 1000/,
    );
  });

  it("trade catalogue — every template proposes, allocates and settles atomically", () => {
    for (const t of TRADE_TEMPLATES) {
      const result = store.runFullDemo({ templateId: t.id });
      assert.equal(result.error, null, `${t.id} errored: ${result.error}`);
      assert.equal(result.composition.status, "settled", t.id);
      assert.equal(result.composition.templateId, t.id);
      assert.equal(result.composition.tradeName, t.name);
      assert.equal(result.composition.legs.length, t.legs.length);
      for (const leg of result.composition.legs) {
        const tok = store.tokens.get(leg.assetCid);
        assert.equal(tok?.owner, leg.receiver, `${t.id}/${leg.legId} not delivered`);
      }
      // Regulator still sees receipts only, never tokens
      assert.equal(store.partyView("Regulator").visibleTokens.length, 0);
    }
  });

  it("trade catalogue — unknown template is rejected with a helpful message", () => {
    assert.throws(
      () => store.proposeTradeFinance({ templateId: "unobtainium" }),
      /unknown trade template "unobtainium" — choose one of: cocoa/,
    );
  });

  it("trade catalogue — wrong amount still rejected on non-cocoa trades", () => {
    const c = store.proposeTradeFinance({ templateId: "coffee" });
    for (const p of c.counterparties) store.accept(c.id, p);
    const cash = c.legs.find((l) => l.legId === "cash")!;
    assert.throws(
      () => store.allocate(c.id, { ...cash, amount: "1.0" }),
      /allocation match failed: amount mismatch on leg cash/,
    );
    assert.equal(store.require(c.id).allocations.length, 0);
  });

  it("readiness — settled trade reports receipt and per-leg settled flag", () => {
    const result = store.runFullDemo({ templateId: "gold" });
    const r = store.getReadiness(result.composition.id);
    assert.equal(r.status, "settled");
    assert.equal(r.tradeName, "Gold doré purchase");
    assert.ok(r.receiptCid);
    assert.equal(r.allocatedLegs.length, 3);
    assert.ok(r.allocatedLegs.every((l) => l.settled && l.allocationCid));
    assert.equal(r.outstandingLegs.length, 0);
    assert.equal(r.canSettle, false);
  });

  it("collateral cover — computed from template reference prices", () => {
    const c = store.proposeTradeFinance({ templateId: "coffee" });
    // 20 MT × $4,120 = $82,400 collateral vs $64,000 advance → 129%
    assert.equal(c.collateralRatio, "129%");
    const cocoa = store.proposeTradeFinance();
    // 2 CBTC × $65,000 = $130,000 vs $10,000 → 1300% (unchanged behaviour)
    assert.equal(cocoa.collateralRatio, "1300%");
  });

  it("signatures — every counterparty acceptance is its own commit", () => {
    const c = store.proposeTradeFinance({ templateId: "coffee" });
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
    const signed = store.require(c.id).commits.filter((x) => x.choice === "AcceptProposal");
    assert.deepEqual(
      signed.map((x) => x.actAs[1]),
      ["Bob", "Oracle"],
    );
    assert.ok(store.require(c.id).commits.some((x) => x.choice === "FinalizeAgreement"));
  });

  it("auditor view — receipts newest first and scoped to one trade", () => {
    const gold = store.runFullDemo({ templateId: "gold" }).composition;
    const cotton = store.runFullDemo({ templateId: "cotton" }).composition;
    const all = store.partyView("Regulator");
    assert.equal(all.settlementReceipts[0].compositionId, cotton.id);
    assert.equal(all.settlementReceipts[0].tradeName, "Cotton lint forward");

    const scoped = store.partyView("Regulator", gold.id);
    assert.equal(scoped.settlementReceipts.length, 1);
    assert.equal(scoped.settlementReceipts[0].compositionId, gold.id);
    assert.equal(scoped.visibleTokens.length, 0);

    const lender = store.partyView("Bob", gold.id);
    const goldAssets = new Set(gold.legs.map((l) => l.assetCid));
    assert.ok(lender.visibleTokens.length > 0);
    assert.ok(lender.visibleTokens.every((t) => goldAssets.has(t.contractId)));
  });

  it("cancelled proposal cannot be accepted into an agreement (mirrors FinalizeAgreement)", () => {
    const c = store.proposeTradeFinance({ templateId: "coffee" });
    store.accept(c.id, "Bob");
    store.cancel(c.id, "Alice");
    assert.throws(() => store.accept(c.id, "Oracle"), /cannot accept: proposal is cancelled/);
    assert.equal(store.require(c.id).status, "cancelled");
    assert.equal(store.require(c.id).agreementCid, null);
  });
});
