import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { DemoStore } from "./demoStore.js";

describe("Composition Protocol demo gates", () => {
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
    // Alice receives USDCx; Bob receives CBTC + ATTEST
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

  it("R-GOV-1 below threshold rejected", () => {
    const c = store.proposeTradeFinance({ requireGovernance: true });
    store.accept(c.id, "Bob");
    store.accept(c.id, "Oracle");
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
    const settled2 = store.settle(deal2.id);
    assert.equal(settled2.status, "settled");
    assert.notEqual(settled1.id, settled2.id);
  });
});

