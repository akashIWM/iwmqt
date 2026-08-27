#!/usr/bin/env bash
# Point-in-time-capable backup for the transactional store (users, orders, fills, audit
# log, RMS config - everything that can't be regenerated). Dumps in pg_dump's custom
# format (-Fc), which pg_restore can replay selectively or in full, and is compressed by
# default - a plain SQL dump is neither.
#
# Usage:
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/backup-postgres.sh
#   (falls back to the same default local connection string used in server/.env.example)
#
# Retention: keeps the last RETENTION_DAYS days of backups in BACKUP_DIR, pruning older
# ones on every run - so the policy enforces itself without a separate cron entry.
#
# Intended to run on a schedule (e.g. a daily cron/systemd timer), not just ad hoc.
set -euo pipefail

DATABASE_URL="${DATABASE_URL:-postgres://iwmqt_user:iwmqt_password@localhost:5432/iwmqt}"
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups/postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
out_file="${BACKUP_DIR}/iwmqt-${timestamp}.dump"

echo "Backing up ${DATABASE_URL%%@*}@... -> ${out_file}"
pg_dump --format=custom --file="${out_file}" "${DATABASE_URL}"
echo "Backup complete: $(du -h "${out_file}" | cut -f1)"

echo "Pruning backups older than ${RETENTION_DAYS} days in ${BACKUP_DIR}..."
find "${BACKUP_DIR}" -name 'iwmqt-*.dump' -mtime "+${RETENTION_DAYS}" -print -delete

echo "Current backups:"
ls -lh "${BACKUP_DIR}"
