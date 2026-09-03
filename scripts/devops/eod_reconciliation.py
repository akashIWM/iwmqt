#!/usr/bin/env python3
"""
EOD / post-market reconciliation for iwmQT.

Two independent, read-only checks, meant to run once after market close:

1. Net position check - every (user_id, symbol) position computed from `fills`
   must net to zero. A nonzero row is an open position a trader is still
   carrying and must be verified with them by hand - this script only
   reports it, it never closes anything. Mirrors the exact query in
   server/src/routes/position.routes.js so a row here is a row that would
   also show up on the live Positions grid.

2. Trade/log reconciliation - every fill written by the execution engine
   (server/src/services/executionEngine.service.js) is supposed to be paired
   with an order_events row in the same code path. Those two inserts are NOT
   wrapped in a single DB transaction, so a crash between them would leave a
   fill with no matching log entry (or an event with no fill). This check
   finds any such gap, per order, for the target trading day.

Exit code is 0 when both checks are clean, 1 when either finds a
discrepancy - that's what lets this be wired into a cron job / systemd timer
that only pages someone when there's actually something to look at.

Usage:
    python3 eod_reconciliation.py [--date YYYY-MM-DD]

Reads DATABASE_URL from server/.env (same credential the Node backend uses -
this script deliberately doesn't get its own DB user/password).
"""
import argparse
import os
import sys
from datetime import date, datetime
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / 'server' / '.env')


def get_connection():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print('[FATAL] DATABASE_URL not set (checked server/.env)', file=sys.stderr)
        sys.exit(2)
    return psycopg2.connect(database_url)


def check_net_positions(conn):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT user_id, symbol,
                   SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) AS net_qty
            FROM fills
            GROUP BY user_id, symbol
            HAVING SUM(CASE WHEN side = 'BUY' THEN quantity ELSE -quantity END) <> 0
            ORDER BY user_id, symbol
            """
        )
        return cur.fetchall()


def check_trade_log_reconciliation(conn, target_date):
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            WITH fill_counts AS (
                SELECT order_id, COUNT(*) AS fill_count
                FROM fills
                WHERE created_at::date = %(target_date)s
                GROUP BY order_id
            ),
            event_counts AS (
                SELECT order_id, COUNT(*) AS event_count
                FROM order_events
                WHERE created_at::date = %(target_date)s
                  AND event IN ('PARTIALLY_FILLED', 'EXECUTED')
                GROUP BY order_id
            )
            SELECT
                COALESCE(f.order_id, e.order_id) AS order_id,
                COALESCE(f.fill_count, 0) AS fill_count,
                COALESCE(e.event_count, 0) AS event_count
            FROM fill_counts f
            FULL OUTER JOIN event_counts e ON f.order_id = e.order_id
            WHERE COALESCE(f.fill_count, 0) <> COALESCE(e.event_count, 0)
            ORDER BY order_id
            """,
            {'target_date': target_date},
        )
        return cur.fetchall()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        '--date', type=lambda s: datetime.strptime(s, '%Y-%m-%d').date(), default=date.today(),
        help='trading day to reconcile trade/log entries for (default: today)',
    )
    args = parser.parse_args()

    conn = get_connection()
    try:
        open_positions = check_net_positions(conn)
        mismatches = check_trade_log_reconciliation(conn, args.date)
    finally:
        conn.close()

    print(f'=== EOD Reconciliation Report - {args.date.isoformat()} ===\n')

    print(f'[1] Net position check (all open positions, any day): {len(open_positions)} nonzero')
    for row in open_positions:
        print(f"    OPEN POSITION  user={row['user_id']:<12} symbol={row['symbol']:<20} net_qty={row['net_qty']}")
    if not open_positions:
        print('    OK - every trader is flat.')

    print(f"\n[2] Trade/log reconciliation for {args.date.isoformat()}: {len(mismatches)} mismatched order(s)")
    for row in mismatches:
        print(f"    MISMATCH  order_id={row['order_id']}  fills={row['fill_count']}  order_events={row['event_count']}")
    if not mismatches:
        print('    OK - every fill has a matching log entry.')

    if open_positions or mismatches:
        print(
            '\nRESULT: DISCREPANCIES FOUND - open positions need trader confirmation; '
            'log mismatches need investigation before this session is closed out.'
        )
        sys.exit(1)

    print('\nRESULT: CLEAN - all positions flat, all trades logged.')
    sys.exit(0)


if __name__ == '__main__':
    main()
