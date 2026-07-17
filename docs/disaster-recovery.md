# Disaster Recovery

## Backup Strategy

### Automated Backup

Run `scripts/backup.sh` daily (e.g., via cron or systemd timer):

```
0 2 * * * /opt/flowmind/scripts/backup.sh >> /var/log/flowmind-backup.log 2>&1
```

### What Gets Backed Up

| Asset | Method | Retention |
|---|---|---|
| PostgreSQL (DB) | `pg_dump -F c` (custom format) | 30 days |
| Redis | RDB snapshot | 30 days |
| Qdrant (vector DB) | snapshot API | 30 days |
| .env files | tar archive | 30 days |

### Configuration

| Env Variable | Default | Description |
|---|---|---|
| `BACKUP_DIR` | `./backups` | Output directory |
| `DB_CONTAINER` | `flowmind-postgres-1` | PostgreSQL container name |
| `RETENTION_DAYS` | `30` | Days to keep backups |

## Restore Procedures

### Full Stack Restore

```bash
# 1. Restore PostgreSQL
docker exec -i flowmind-postgres-1 pg_restore -U flowmind -d flowmind -F c < backups/flowmind_db_20250101_000000.dump

# 2. Restore Redis
docker cp backups/redis_20250101_000000.rdb flowmind-redis-1:/data/dump.rdb
docker restart flowmind-redis-1

# 3. Restore Qdrant
docker cp backups/qdrant_20250101_000000.snapshot flowmind-qdrant-1:/qdrant/snapshots/
curl -X PUT 'http://localhost:6333/collections/my-collection/snapshots/recover' \
  -H 'Content-Type: application/json' \
  -d '{"location": "/qdrant/snapshots/qdrant_20250101_000000.snapshot"}'

# 4. Restore env files
tar xzf backups/env_20250101_000000.tar.gz

# 5. Restart services
docker compose -f infra/compose/production.yml down
docker compose -f infra/compose/production.yml up -d
```

### Point-in-Time Recovery (PostgreSQL)

If WAL archiving was configured (not in default setup), use `pg_restore --time` with the dump. Otherwise, full dump restore is point-in-time to the dump time.

### Validation

After restore, verify:

```bash
# Health check
curl -f http://localhost:3001/health

# DB connectivity (should return {"status":"ok","db":true})
curl http://localhost:3001/health

# Run e2e smoke test
pnpm test:e2e
```

## Runbook: Common Failure Scenarios

### Scenario 1: Container Crash

```bash
docker compose -f infra/compose/production.yml logs --tail=50 api
docker compose -f infra/compose/production.yml restart api
```

### Scenario 2: Database Corruption

```bash
# Stop dependent services
docker compose -f infra/compose/production.yml stop api web agent

# Restore DB from last backup (see Full Stack Restore above)

# Restart
docker compose -f infra/compose/production.yml up -d
```

### Scenario 3: Full Data Loss

```bash
# Re-clone repository
git clone https://github.com/your-org/flowmind.git
cd flowmind

# Restore all data (see Full Stack Restore above)

# Run migrations
pnpm db:migrate

# Rebuild images
docker compose -f infra/compose/production.yml build

# Start
docker compose -f infra/compose/production.yml up -d
```

## Monitoring

- Set up Prometheus alert on `up{job="api"} == 0` for API downtime
- Alert on `pg_replication_lag` > 60s if using Postgres replicas
- Verify backup completeness daily with `scripts/backup.sh` exit code check
