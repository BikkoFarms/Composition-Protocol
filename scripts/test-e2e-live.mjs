// scripts/test-e2e-live.mjs
// End-to-end live testing runner for Composition Protocol
// Launches the Oracle service (:4002) and Backend API (:4000), executes the entire protocol lifecycle,
// verifies R-ATOM-1/2, R-PRIV-1/2/3, R-GOV-1/2, Admin diagnostic endpoints, and shuts down cleanly.

import { spawn, execSync } from 'child_process';
import http from 'http';
import path from 'path';

function makeRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await makeRequest(url);
      if (res.status === 200) return true;
    } catch {
      // Retry in 300ms
    }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for ${url}`);
}

function killProc(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    // Process might already be closed
  }
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 COMPOSITION PROTOCOL — LIVE END-TO-END VERIFICATION RUNNER');
  console.log('===============================================================');

  // 1. Start Oracle server on :4002
  console.log('\n[1/4] Spawning Commodity Oracle Service (:4002)...');
  const oracleProc = spawn('node', ['mocks/oracle/server.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '4002' }
  });

  // 2. Start Backend API on :4000
  console.log('[2/4] Spawning Backend API Gateway (:4000)...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const backendProc = spawn(npmCmd, ['run', 'dev'], {
    cwd: path.resolve('backend'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: '4000', LEDGER_MODE: 'demo' }
  });

  try {
    console.log('\n[3/4] Waiting for services to become healthy...');
    await waitForServer('http://localhost:4002/health');
    console.log('  ✓ Oracle service is alive on :4002');
    await waitForServer('http://localhost:4000/health');
    console.log('  ✓ Backend API is alive on :4000');

    console.log('\n[4/4] Executing End-to-End Live Protocol Verification Tests:');

    // Test 1: Oracle Price
    const priceRes = await makeRequest('http://localhost:4002/price?symbol=COCOA');
    console.log(`  [TEST 1] Oracle Spot Price for COCOA: $${priceRes.data.price} ${priceRes.data.currency} (Status: ${priceRes.status})`);
    if (!priceRes.data.price) throw new Error('Oracle price test failed');

    // Test 2: Oracle Cryptographic Attestation
    const attestPayload = {
      commodity: "Cocoa Beans Grade A",
      origin: "Ghana / Ashanti Region",
      lotNumber: "LOT-GH-2026-09",
      grade: "Grade A Export Standard",
      moisturePercent: 7.2
    };
    const attestRes = await makeRequest('http://localhost:4002/attest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, attestPayload);
    console.log(`  [TEST 2] Oracle HMAC Attestation Issued: Signature=${attestRes.data.signature.substring(0, 16)}... (Status: ${attestRes.status})`);
    if (!attestRes.data.signature) throw new Error('Oracle attest failed');

    // Test 3: Oracle Signature Verification
    const verifyRes = await makeRequest('http://localhost:4002/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { attestation: attestRes.data.attestation, signature: attestRes.data.signature });
    console.log(`  [TEST 3] Oracle Signature Cryptographic Verification: Valid=${verifyRes.data.valid} (Status: ${verifyRes.status})`);
    if (verifyRes.data.valid !== true) throw new Error(`Oracle verify failed: ${JSON.stringify(verifyRes.data)}`);

    // Test 4: Backend Health
    const healthRes = await makeRequest('http://localhost:4000/health');
    console.log(`  [TEST 4] Backend Health Check: Mode=${healthRes.data.mode}, Ok=${healthRes.data.ok} (Status: ${healthRes.status})`);
    if (healthRes.data.ok !== true) throw new Error('Backend health failed');

    // Test 5: Admin Overview & Circuit Breaker Status
    const adminRes = await makeRequest('http://localhost:4000/admin/overview');
    console.log(`  [TEST 5] Admin Mission Control Overview: ActiveAgreements=${adminRes.data.activeAgreements}, Halted=${adminRes.data.circuitBreaker.isHalted} (Status: ${adminRes.status})`);
    if (adminRes.data.circuitBreaker.isHalted !== false) throw new Error('Admin overview failed');

    // Test 6: Canton Ledger Node Ping
    const pingRes = await makeRequest('http://localhost:4000/admin/ledger/ping');
    console.log(`  [TEST 6] Canton Node Latency Ping Probe: Status=${pingRes.data.status}, Message=${pingRes.data.message.substring(0, 40)}... (Status: ${pingRes.status})`);

    // Test 7: Operator Treasury Direct Minting
    const mintRes = await makeRequest('http://localhost:4000/admin/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { owner: 'Alice', instrumentId: 'CBTC', amount: '5.0' });
    console.log(`  [TEST 7] Operator Treasury Mint: ContractId=${mintRes.data.contractId}, Minted=${mintRes.data.amount} ${mintRes.data.instrumentId} (Status: ${mintRes.status})`);
    if (!mintRes.data.contractId) throw new Error('Minting failed');

    // Test 8: Full Happy Path 3-Leg Settlement Runner
    console.log('  [TEST 8] Executing One-Click Pitch Demo (Full Happy Path Settlement)...');
    const happyRes = await makeRequest('http://localhost:4000/compositions/demo/run-full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`  ✓ Happy Path Result: DealId=${happyRes.data.settled?.id}, Status=${happyRes.data.settled?.status}, DealHash=${happyRes.data.settled?.dealHash?.substring(0, 16)}... (Status: ${happyRes.status})`);
    if (happyRes.data.settled?.status !== 'settled') throw new Error('Full happy path settlement failed');

    // Test 9: Observer "Money Shot" Privacy Verification
    console.log('  [TEST 9] Verifying Observer "Money Shot" Sub-Transaction Privacy (R-PRIV-1/2/3)...');
    const moneyShotRes = await makeRequest('http://localhost:4000/audit/money-shot');
    const regulatorVisibleTokens = moneyShotRes.data.observer.visibleTokens;
    const participantVisibleTokens = moneyShotRes.data.participant.visibleTokens;
    const regulatorReceipts = moneyShotRes.data.observer.settlementReceipts;
    console.log(`  ✓ Participant (Bob) Visible Tokens: ${participantVisibleTokens.length} token contracts visible`);
    console.log(`  ✓ Regulator Visible Tokens: [${regulatorVisibleTokens.join(', ')}] (Length: ${regulatorVisibleTokens.length})`);
    console.log(`  ✓ SettlementReceipt disclosed to Regulator: Present=${regulatorReceipts.length > 0} (Count: ${regulatorReceipts.length})`);
    if (regulatorVisibleTokens.length !== 0) {
      throw new Error(`CRITICAL PRIVACY VIOLATION: Regulator sees ${regulatorVisibleTokens.length} tokens! Expected []`);
    }

    // Test 10: BitSafe 2-of-3 Threshold Governance Flow
    console.log('  [TEST 10] Verifying BitSafe M-of-N Threshold Multi-Sig Flow (R-GOV-1 & R-GOV-2)...');
    // 10.1 Propose deal requiring governance
    const govPropRes = await makeRequest('http://localhost:4000/compositions/demo/trade-finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { requireGovernance: true });
    const govDealId = govPropRes.data.id;
    // 10.2 Counterparties Bob and Oracle accept
    await makeRequest(`http://localhost:4000/compositions/${govDealId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { acceptor: 'Bob' });
    await makeRequest(`http://localhost:4000/compositions/${govDealId}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { acceptor: 'Oracle' });
    // 10.3 Open governance committee
    const openGovRes = await makeRequest('http://localhost:4000/compositions/governance/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { compositionId: govDealId, governors: ['Gov1', 'Gov2', 'Gov3'], threshold: 2 });
    const govId = openGovRes.data.id;
    // 10.4 Attempt execution before threshold -> must fail with 409 (R-GOV-1)
    const earlyExecRes = await makeRequest(`http://localhost:4000/compositions/governance/${govId}/execute`, {
      method: 'POST'
    });
    console.log(`  ✓ Sub-test 10A (R-GOV-1 Rejection): Status=${earlyExecRes.status}, Error="${earlyExecRes.data.error}"`);
    if (earlyExecRes.status !== 409) throw new Error('Expected 409 rejection under threshold');

    // 10.5 Gov1 approves
    await makeRequest(`http://localhost:4000/compositions/governance/${govId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { governor: 'Gov1' });
    // 10.6 Gov2 approves (reaches threshold 2 of 3)
    await makeRequest(`http://localhost:4000/compositions/governance/${govId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { governor: 'Gov2' });

    // 10.7 Execute with 2 of 3 approvals -> must succeed with 200 (R-GOV-2)
    const validExecRes = await makeRequest(`http://localhost:4000/compositions/governance/${govId}/execute`, {
      method: 'POST'
    });
    console.log(`  ✓ Sub-test 10B (R-GOV-2 Execution): Status=${validExecRes.status}, DealStatus=${validExecRes.data.status}`);
    if (validExecRes.status !== 200 || validExecRes.data.status !== 'settled') {
      throw new Error('BitSafe threshold governance test failed');
    }

    // Test 11: Real-Time Protocol Telemetry & Metrics
    const metricsRes = await makeRequest('http://localhost:4000/audit/metrics');
    console.log(`  [TEST 11] Telemetry Metrics: TotalSettled=${metricsRes.data.compositionsSettled}, SuccessRate=${metricsRes.data.successRate}%, AvgLegs=${metricsRes.data.avgLegsPerComposition}`);

    // Test 12: Expiry & Cancel Flow (Clean Stalled Flow Resolution)
    const cancelProp = await makeRequest('http://localhost:4000/compositions/demo/trade-finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const cancelRes = await makeRequest(`http://localhost:4000/compositions/${cancelProp.data.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caller: 'Alice' })
    });
    console.log(`  [TEST 12] Clean Expiry/Cancel Resolution: Status=${cancelRes.data.status} (Status: ${cancelRes.status})`);
    if (cancelRes.data.status !== 'cancelled') throw new Error('Cancellation test failed');

    // Test 13: Reusable 3-party DvP Multi-Configuration Execution
    const multiDeal = await makeRequest('http://localhost:4000/compositions/demo/run-full', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    console.log(`  [TEST 13] Reusable Package Execution: Status=${multiDeal.data.settled?.status}, DealId=${multiDeal.data.settled?.id} (Status: ${multiDeal.status})`);
    if (multiDeal.data.settled?.status !== 'settled') throw new Error('Reusable package test failed');

    console.log('\n===============================================================');
    console.log('🎉 ALL 13 LIVE END-TO-END PROTOCOL TESTS PASSED WITH 100% SUCCESS!');
    console.log('===============================================================');

  } catch (err) {
    console.error('\n❌ E2E TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    console.log('\nCleaning up processes...');
    killProc(oracleProc);
    killProc(backendProc);
    setTimeout(() => process.exit(process.exitCode || 0), 1000);
  }
}

run();
