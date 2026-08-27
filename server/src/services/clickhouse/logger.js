import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER,
  password: process.env.CLICKHOUSE_PASSWORD,
  database: process.env.CLICKHOUSE_DATABASE,
});

// Batched tick insert - called once per market-tick cycle with every instrument that moved
// that cycle (never one row per instrument per call), since ClickHouse wants bulk writes,
// not a stream of single-row inserts.
export const logMarketTicks = async (ticks) => {
  if (ticks.length === 0) return;
  try {
    await client.insert({
      table: 'market_ticks',
      values: ticks,
      format: 'JSONEachRow',
    });
  } catch (error) {
    // Same fail-soft principle as auth events: a persistence hiccup must never break the
    // live price feed itself.
    console.error('[CLICKHOUSE ERROR] Failed to log market ticks:', error.message);
  }
};

export const logAuthEvent = async (eventData) => {
  try {
    const { event_type, user_id, role = '', company_id = '', success, ip_address, user_agent, metadata = '{}' } = eventData;
    
    await client.insert({
      table: 'auth_events',
      values: [{ event_type, user_id, role, company_id, success: success ? 1 : 0, ip_address, user_agent, metadata }],
      format: 'JSONEachRow',
    });
  } catch (error) {
    // Failure handling: Authentication must not fail if ClickHouse logging fails.
    console.error('[CLICKHOUSE ERROR] Failed to log auth event:', error.message);
  }
};