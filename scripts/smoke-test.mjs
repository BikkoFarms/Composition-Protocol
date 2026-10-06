#!/usr/bin/env node
/**
 * Settle Flow smoke test — exercises every user-facing settlement flow against a
 * running API (default http://localhost:4000, override with API_URL=…).
 *
 *   npm run test:smoke
 *   API_URL=https://settleflow-backend-zcp7.onrender.com npm run test:smoke
 *
 * Covers: health, trade catalogue, per-trade propose → accept → wrong-amount
 * reject → allocate → settle → readiness (incl. settled rows) → auditor privacy,
 * plus withdraw, cancel, forced revert and BitSafe governance paths.
 */

const API = (process.env.API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

let passed = 0;
let failed = 0;

async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${method} ${path} returned non-JSON (HTTP ${res.status})`);
  }
  return { status: res.status, data };
}

async function ok(method, path, body) {
  const { status, data } = await call(method, path, body);
  if (status >= 400) throw new Error(`${method} ${path} → ${status}: ${data.error ?? JSON.stringify(data)}`);
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${e.message}`);
  }
}

console.log(`\nSettle Flow smoke test → ${API}\n`);

await check("API health", async () => {
  const h = await ok("GET", "/health");
  assert(h.ok === true, "health not ok");
});

let templates = [];
await check("trade catalogue lists more than cocoa", async () => {
  const t = await ok("GET", "/compositions/templates");
  templates = t.templates;
  assert(templates.length >= 5, `only ${templates.length} templates`);
  assert(templates.some((x) => x.id === "cocoa"), "cocoa missing");
});

for (const t of templates) {
  await check(`${t.name}: propose → reject wrong amount → lock → settle → readiness`, async () => {
    const desk = await ok("POST", "/compositions/demo/open-desk", { templateId: t.id });
    const c = desk.composition;
    assert(c.status === "accepted", `expected accepted, got ${c.status}`);
    assert(c.tradeName === t.name, "tradeName missing");

    const target = c.legs.find((l) => l.legId === "cash") ?? c.legs[1];
    const bad = await call("POST", `/compositions/${c.id}/allocate`, {
      ...target,
      amount: String(Number(target.amount) * 10),
    });
    assert(bad.status === 409, `wrong amount returned ${bad.status}, expected 409`);
    assert(/amount mismatch/.test(bad.data.error), `unexpected reject reason: ${bad.data.error}`);

    for (const leg of c.legs) await ok("POST", `/compositions/${c.id}/allocate`, leg);
    const settled = await ok("POST", `/compositions/${c.id}/settle`, { caller: "Operator" });
    assert(settled.status === "settled", `settle returned ${settled.status}`);
    assert(settled.receiptCid, "no receipt");

    const r = await ok("GET", `/compositions/${c.id}/readiness`);
    assert(r.status === "settled", "readiness not settled");
    assert(r.allocatedLegs.length === t.legs.length, "settled legs missing from readiness");
    assert(r.allocatedLegs.every((l) => l.settled), "settled flag missing on rows");
    assert(r.receiptCid === settled.receiptCid, "readiness receipt mismatch");
  });
}

await check("auditor sees receipts but zero tokens", async () => {
  const shot = await ok("GET", "/audit/money-shot");
  assert(shot.observer.visibleTokens.length === 0, "regulator can see tokens!");
  assert(shot.observer.settlementReceipts.length > 0, "no receipts for regulator");
});

await check("withdraw a locked leg, then settle", async () => {
  const { composition: c } = await ok("POST", "/compositions/demo/open-desk", {});
  await ok("POST", `/compositions/${c.id}/allocate-all`);
  await ok("POST", `/compositions/${c.id}/withdraw-leg`, { legId: c.legs[0].legId, caller: c.legs[0].provider });
  const mid = await ok("GET", `/compositions/${c.id}/readiness`);
  assert(mid.outstandingLegs.length === 1 && !mid.canSettle, "withdraw did not unlock leg");
  await ok("POST", `/compositions/${c.id}/allocate-all`);
  const s = await ok("POST", `/compositions/${c.id}/settle`, { caller: "Operator" });
  assert(s.status === "settled", "settle after re-lock failed");
});

await check("cancel before settlement releases everything", async () => {
  const c = await ok("POST", "/compositions/demo/trade-finance", { templateId: "coffee" });
  const x = await ok("POST", `/compositions/${c.id}/cancel`, { caller: "Alice" });
  assert(x.status === "cancelled", "not cancelled");
  const bad = await call("POST", `/compositions/${c.id}/settle`, {});
  assert(bad.status === 409, "cancelled trade could be settled");
});

await check("broken trade reverts atomically (no half state)", async () => {
  const res = await call("POST", "/compositions/demo/run-full", { forceFail: true, templateId: "gold" });
  assert(res.status === 409, `expected 409, got ${res.status}`);
  assert(res.data.composition.status === "reverted", "not reverted");
});

await check("BitSafe: refuses below threshold, settles at 2-of-3", async () => {
  const c = await ok("POST", "/compositions/demo/trade-finance", { requireGovernance: true, templateId: "cashew" });
  for (const p of c.counterparties) await ok("POST", `/compositions/${c.id}/accept`, { acceptor: p });
  const opened = await ok("POST", `/compositions/${c.id}/settle`, {});
  assert(opened.status === "awaiting_governance", "governance gate not opened");
  const g = opened.governanceCid;
  await ok("POST", `/compositions/governance/${g}/approve`, { governor: "Gov1" });
  const early = await call("POST", `/compositions/governance/${g}/execute`, {});
  assert(early.status === 409 && /below threshold/.test(early.data.error), "executed below threshold");
  await ok("POST", `/compositions/governance/${g}/approve`, { governor: "Gov2" });
  const done = await ok("POST", `/compositions/governance/${g}/execute`, {});
  assert(done.status === "settled", "governed settle failed");
});

await check("oracle quotes non-cocoa symbols", async () => {
  const q = await ok("GET", "/oracle/price?symbol=COFFEE");
  assert(q.symbol === "COFFEE", `got ${q.symbol}`);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
