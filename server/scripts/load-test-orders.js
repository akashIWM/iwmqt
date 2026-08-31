// Load test for POST /api/orders/place - measures real throughput/latency under a
// concurrent order-placement burst and reports how the system actually behaves against
// NSE's 120 orders/sec-per-user cap (server/src/middleware/opsRateLimit.middleware.js),
// rather than just trusting that the limiter's code is correct in isolation.
//
// Deliberately does NOT disable the other RMS pre-trade controls (max open orders, price
// band, etc.) during the run - seeing how they interact under real burst load is part of
// what "load testing at realistic volume" is supposed to reveal, not something to mask.
//
// Usage: node scripts/load-test-orders.js [--users 5] [--duration 8] [--rate 130] [--base-url http://localhost:3000]
// (rate is requests/sec PER user - set above 120 on purpose, to see the limiter actually
// reject the excess rather than just approach the cap from below)
//
// Always creates fresh, disposable TRADER accounts for every virtual user - never reuses a
// real pre-existing trader. Cleanup deletes only rows scoped to those disposable accounts,
// so it can never touch a real trader's order/fill/audit history no matter what already
// existed before the run.

import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { query } from '../src/db/postgres.js';

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 2) {
  args[argv[i].replace(/^--/, '')] = argv[i + 1];
}
const NUM_USERS = Number(args.users) || 5;
const DURATION_SEC = Number(args.duration) || 8;
const RATE_PER_USER = Number(args.rate) || 130;
const BASE_URL = args['base-url'] || 'http://localhost:3000';

// Prices set relative to each symbol's known prevClose (server/src/services/marketData.service.js)
// far enough through the live LTP to virtually guarantee an immediate match on the next tick,
// while staying inside the default 20% price band - so orders don't pile up as PENDING and
// trip Control 8 (max open orders) purely as an artifact of the test's own order prices.
const TEST_SYMBOLS = [
  { symbol: 'RELIANCE FUT', prevClose: 2970.00 },
  { symbol: 'HDFCBANK FUT', prevClose: 1655.00 }
];

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

// Every virtual user is a brand-new account created just for this run, with a user_id
// prefix ('loadtest_') distinct enough that cleanup can never collide with a real trader's
// data - reusing an existing account here previously caused cleanup to delete a real
// trader's order history (see git history / commit message for this file).
async function createTestUsers(count) {
  const users = [];
  for (let i = 0; i < count; i += 1) {
    const userId = `loadtest_trader_${i}_${Date.now()}`;
    await query(
      `INSERT INTO users (user_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, 'not_a_real_hash_load_test_only', 'TRADER')`,
      [userId, `Load Test Trader ${i}`, `${userId}@loadtest.local`]
    );
    users.push({ userId });
  }
  return users;
}

function mintToken(userId) {
  // No `sid` claim on purpose - skips the active-session DB check entirely (see
  // server/src/middleware/auth.middleware.js), which is correct here since these virtual
  // users never go through the real login flow.
  return jwt.sign({ userId, role: 'TRADER' }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function randomOrderPayload(i) {
  const { symbol, prevClose } = TEST_SYMBOLS[i % TEST_SYMBOLS.length];
  const side = i % 2 === 0 ? 'BUY' : 'SELL';
  const price = side === 'BUY' ? prevClose * 1.15 : prevClose * 0.85;
  return {
    symbol,
    side,
    type: 'LIMIT',
    quantity: 5,
    price: Number(price.toFixed(2))
  };
}

async function fireOrder(token, payload, results) {
  const start = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/api/orders/place`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: `token=${token}` },
      body: JSON.stringify(payload)
    });
    const latency = performance.now() - start;
    const body = await res.json().catch(() => ({}));
    results.latencies.push(latency);
    results.statusCounts[res.status] = (results.statusCounts[res.status] || 0) + 1;
    if (res.status === 429) {
      results.opsCapped += 1;
    } else if (res.status >= 400) {
      const reason = (body.message || body.error || 'unknown').slice(0, 60);
      results.rejectionReasons[reason] = (results.rejectionReasons[reason] || 0) + 1;
    } else {
      results.accepted += 1;
    }
  } catch (error) {
    results.networkErrors += 1;
    results.errorSamples.push(error.message);
  }
}

async function runVirtualUser(userId, token, results) {
  const intervalMs = 1000 / RATE_PER_USER;
  const endAt = performance.now() + DURATION_SEC * 1000;
  let i = 0;
  const inFlight = [];
  while (performance.now() < endAt) {
    const payload = randomOrderPayload(i);
    inFlight.push(fireOrder(token, payload, results));
    i += 1;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  await Promise.all(inFlight);
  return i;
}

async function main() {
  console.log(`Load test: ${NUM_USERS} users, ${RATE_PER_USER} req/s/user target, ${DURATION_SEC}s -> aggregate target ${NUM_USERS * RATE_PER_USER} req/s`);

  const users = await createTestUsers(NUM_USERS);
  console.log(`Created ${users.length} disposable trader accounts for this run`);

  const results = {
    latencies: [],
    statusCounts: {},
    opsCapped: 0,
    accepted: 0,
    rejectionReasons: {},
    networkErrors: 0,
    errorSamples: []
  };

  const start = performance.now();
  const perUserSent = await Promise.all(
    users.map((u) => runVirtualUser(u.userId, mintToken(u.userId), results))
  );
  const wallSeconds = (performance.now() - start) / 1000;
  const totalSent = perUserSent.reduce((a, b) => a + b, 0);

  console.log('\nWaiting 2s for the matching engine to catch up on the final tick cycle...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const userIds = users.map((u) => u.userId);
  const statusBreakdown = (await query(
    `SELECT status, COUNT(*) FROM orders WHERE user_id = ANY($1) GROUP BY status`,
    [userIds]
  )).rows;

  const sortedLatencies = [...results.latencies].sort((a, b) => a - b);

  console.log('\n=== RESULTS ===');
  console.log(`Requests sent: ${totalSent} over ${wallSeconds.toFixed(1)}s wall time -> ${(totalSent / wallSeconds).toFixed(1)} req/s aggregate achieved`);
  console.log(`HTTP status breakdown: ${JSON.stringify(results.statusCounts)}`);
  console.log(`Accepted (order created): ${results.accepted}`);
  console.log(`Rejected by OPS cap (429, "max ${RATE_PER_USER > 120 ? '120' : RATE_PER_USER}/sec"): ${results.opsCapped}`);
  if (Object.keys(results.rejectionReasons).length) {
    console.log('Other rejections by reason:', results.rejectionReasons);
  }
  if (results.networkErrors) {
    console.log(`Network/connection errors: ${results.networkErrors} (sample: ${results.errorSamples[0]})`);
  }
  console.log(`Latency (accepted+rejected requests, ms): p50=${percentile(sortedLatencies, 0.5)?.toFixed(1)} p95=${percentile(sortedLatencies, 0.95)?.toFixed(1)} p99=${percentile(sortedLatencies, 0.99)?.toFixed(1)} max=${sortedLatencies[sortedLatencies.length - 1]?.toFixed(1)}`);
  console.log('Order status in DB after the run (did the matching engine keep up?):', statusBreakdown);

  console.log('\nCleaning up test data...');
  // Hard guard, not just a convention: refuse to run any DELETE if anything in this list
  // isn't one of the disposable accounts this run just created - a mistake here previously
  // deleted a real trader's order history, so this check exists specifically to make that
  // class of bug impossible even if createTestUsers is changed carelessly in the future.
  const unsafe = userIds.filter((id) => !id.startsWith('loadtest_'));
  if (unsafe.length) {
    throw new Error(`Refusing to clean up - non-disposable user_id(s) in scope: ${unsafe.join(', ')}`);
  }
  await query(`DELETE FROM fills WHERE user_id = ANY($1)`, [userIds]);
  await query(`DELETE FROM order_events WHERE user_id = ANY($1)`, [userIds]);
  await query(`DELETE FROM orders WHERE user_id = ANY($1)`, [userIds]);
  await query(`DELETE FROM audit_log WHERE actor_user_id = ANY($1)`, [userIds]);
  await query(`DELETE FROM users WHERE user_id = ANY($1)`, [userIds]);
  console.log(`Done - removed test orders/fills/events/audit rows and ${userIds.length} disposable user accounts.`);

  process.exit(0);
}

main().catch((error) => {
  console.error('Load test failed:', error);
  process.exit(1);
});
