# Database Redundancy & Failover

## Current state

Single Postgres instance, no standby, no replication. If it goes down, the platform is down
until someone manually restores from a backup (see `BACKUP_AND_RETENTION.md`) - that's
recovery measured in however long a manual restore takes, not failover measured in seconds.
Not built yet, and deliberately not started - see "Why this is waiting" below.

This is a different problem from backup: backup protects against **data loss** (the DB gets
destroyed, can we get the data back). Redundancy protects against **downtime** (the DB
server dies right now, does trading keep working). Also distinct from PgBouncer (already in
place) - that pools connections to one instance, it doesn't provide a second one to fail
over to.

## What real redundancy requires

Two layers, both necessary:

1. **Data-layer redundancy** - a standby replica continuously receiving every write the
   primary makes (Postgres streaming replication), so a second up-to-date copy of the data
   always exists.
2. **Process-layer redundancy (failover)** - something that detects the primary is actually
   dead (not just slow), promotes the standby to primary, and redirects the app's traffic to
   it - automatically, without a human paging in at 3am to do it by hand.

The app itself needs no code changes for either path below - it already connects via a
single `DATABASE_URL` (`server/src/db/postgres.js`), so failover just means that URL needs
to resolve to whichever instance is currently primary. Where that stability comes from
differs by path.

## Path A - managed cloud Postgres (recommended default)

AWS RDS Multi-AZ, GCP Cloud SQL HA, Azure Database for PostgreSQL zone-redundant HA (or
equivalents on other providers) all provide both layers as a **configuration toggle**, not
custom engineering: the provider runs the standby, detects failure, promotes, and keeps a
single stable connection endpoint pointed at whichever instance is currently primary.
Typically also includes automated backups as part of the same feature, which could
eventually replace the hand-rolled `backup-postgres.sh` script - or that script can keep
running independently as a second, provider-independent copy.

For a platform handling real trading data, this is the standard choice - the failure modes
of hand-rolled replication/failover are well-trodden and expensive to get wrong, and a
managed service has already paid that cost.

## Path B - self-hosted Postgres

If self-hosting is chosen instead (e.g. on plain VMs), redundancy has to be built by hand:

- **Replication**: Postgres streaming replication - a standby with `primary_conninfo`
  pointed at the primary, replicating continuously. `synchronous_commit`/
  `synchronous_standby_names` on the primary if zero-data-loss failover is required (at a
  latency cost on every write); async replication otherwise (small window of possible data
  loss on an unclean failover, lower latency day-to-day).
- **Failover orchestration** - something has to watch the primary's health and actually
  perform the promotion. The standard tools: **Patroni** (the current de facto standard,
  handles health-checking, promotion, and re-pointing the app's connection endpoint together)
  or **repmgr** (older, simpler, does less automatically). **pg_auto_failover** is a lighter
  alternative from the Citus/Microsoft team.
- **Traffic redirection** - the app's `DATABASE_URL` needs to keep resolving to the current
  primary after a promotion. Patroni is usually paired with a proxy (HAProxy, or PgBouncer
  pointed at Patroni's REST health endpoint) that always routes to whichever node Patroni
  currently considers primary.

## Why this is waiting

Both the Go-Live Readiness assessment and this doc keep landing on the same blocker:
**no deployment target has been chosen yet**. That decision determines which of the two
paths above applies, and they're different enough (a config toggle vs. standing up Patroni)
that building Path B now would very likely be thrown away if the eventual choice is a
managed cloud database - which is the more common and generally safer choice for this kind
of platform anyway. Recommendation: decide the deployment target first, then this becomes
either a short provider-console task (Path A) or a scoped follow-up engineering task
(Path B) - not a decision to make blind right now.

## ClickHouse

Same situation, lower priority: single instance, no replication. ClickHouse has its own
mechanism for this (`ReplicatedMergeTree` tables + ClickHouse Keeper for coordination) if it
becomes necessary, but tick data is comparatively disposable (see `BACKUP_AND_RETENTION.md`)
and auth-event history, while important, is lower-volume - this is reasonable to defer
further behind the Postgres redundancy decision above.
