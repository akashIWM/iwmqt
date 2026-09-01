import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || undefined,
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
});

export const query = (text, params) => pool.query(text, params);

// pool.query() checks out a different connection per call - fine for single statements, but
// BEGIN/COMMIT issued that way could each land on a different connection and do nothing
// useful together. Real multi-statement atomicity needs one client held for the whole
// transaction, which is what this provides: runs `fn(client)` (using client.query, not the
// pool-wide `query` export, for every statement inside it) between BEGIN/COMMIT, rolling
// back and re-throwing on any failure, and always releasing the client back to the pool.
export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};