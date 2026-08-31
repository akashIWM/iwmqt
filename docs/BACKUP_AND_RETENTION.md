# Backup & Retention Policy

## Postgres (transactional data - users, orders, fills, RMS config, audit log)

**Backup**: `scripts/backup-postgres.sh` runs `pg_dump` in custom format (`-Fc`) - compressed,
and restorable in full or table-by-table via `pg_restore`. Point it at any environment with
`DATABASE_URL`; it defaults to the local dev connection string otherwise.

**Schedule**: runs daily via cron, installed on this machine's `developer` user crontab:

```
0 2 * * * DATABASE_URL=postgres://iwmqt_user:iwmqt_password@localhost:5432/iwmqt /home/developer/iwmqt/scripts/backup-postgres.sh >> /home/developer/iwmqt/backups/backup.log 2>&1
```

(`crontab -l` to view, `crontab -e` to edit.) On a real deployment target, this becomes
either the same crontab entry pointed at that environment's `DATABASE_URL`, or a systemd
timer if that's the platform's convention - the script itself doesn't change either way.

**Retention**: 14 days by default (`RETENTION_DAYS` env var), enforced by the script itself
on every run - no separate cleanup job needed.

**Restore**:

```bash
createdb iwmqt_restore_target
pg_restore --dbname=postgres://user:pass@host:5432/iwmqt_restore_target backups/postgres/iwmqt-<timestamp>.dump
```

Verified 27 Aug 2026: a live backup was taken and its table-of-contents checked with
`pg_restore --list` - all 13 tables, every constraint, FK, and index present and correctly
captured (80 TOC entries).

Verified for real 31 Aug 2026, not just structurally: this backup was actually used to
recover real data after an unrelated incident deleted a trader's order/fill/audit rows
during load-test development. Restored into a disposable container (the default application
role doesn't have `CREATEDB`, so a full restore against the live DB's own role isn't
possible - a throwaway container sidesteps that), the exact rows were extracted and copied
back into the live database, and the recovered data matched the original byte-for-byte (same
IDs, timestamps, and values). This is a stronger proof than the Aug 27 structural check - an
actual restore-and-recover under real conditions, not a drill.

## ClickHouse (ticks, auth events)

**Ticks (`market_ticks`)**: `TTL tick_time + INTERVAL 30 DAY`, applied directly on the table
(`migrations/clickhouse/03_tick_retention.sql`). ClickHouse expires old partitions in the
background automatically - no cron job, no manual `DELETE`, nothing to schedule. Raw ticks
are disposable once they're no longer useful for short-term analysis; if rolled-up OHLC bars
are ever built from them, those bars would get their own (much longer) retention instead.

**Auth events (`auth_events`)**: no TTL, deliberately. This is compliance-relevant
(login/logout/lockout history) and should be retained per whatever audit policy applies,
not auto-expired on a technical default.

## What's not covered here

- ClickHouse backup (as opposed to retention) - not built. Ticks and auth events are
  higher-volume, more disposable, and less critical to restore-on-demand than the
  transactional Postgres data; if that changes, `clickhouse-backup` or native `BACKUP TABLE`
  statements are the standard tool for it.
- Automated restore-drill scheduling - the manual steps above are documented and the backup
  file's structural integrity is verified, but a recurring automated "restore into scratch,
  diff, alert on failure" job is a further step, not built yet.
