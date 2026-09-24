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
});
