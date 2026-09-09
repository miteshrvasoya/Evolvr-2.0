# Evolvr — Operations Guide

## Local Development

### Prerequisites

- Node.js v22+
- pnpm v10+
- Docker Desktop

### Start Services

```bash
# Start Postgres + Redis
docker compose up -d

# Optional: Start pgAdmin (database GUI at localhost:5050)
docker compose --profile tools up -d

# Run migrations
pnpm db:migrate

# Seed admin user (first run only)
pnpm db:seed

# Start all apps
pnpm dev
```

### Stop Services

```bash
docker compose down        # stop but keep data
docker compose down -v     # stop and delete all data
```

### Reset Database

```bash
pnpm docker:reset          # destroys all data and starts fresh
pnpm db:migrate            # re-run all migrations
pnpm db:seed               # re-seed
```

---

## Environment Management

### Required Variables (Minimum)

```bash
JWT_SECRET=<32+ char random string>
ENCRYPTION_KEY=<64-char hex — generate with node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
OPENROUTER_API_KEY=<your key>   # OR any other LLM provider key
```

### Development Defaults

```bash
SIMULATION_MODE=true        # No real Instagram API calls
STORAGE_PROVIDER=local      # Files on disk
LLM_PROVIDER=openrouter    # Change to gemini/openai/anthropic as needed
RESEARCH_PROVIDER=serper   # Cheap Google search API
LOG_FORMAT=pretty           # Human-readable logs
```

---

## Database Migrations

### Apply All Pending Migrations

```bash
pnpm db:migrate
```

### Roll Back Last Migration

```bash
pnpm db:rollback
```

### Migration Files

Located at `apps/api/src/db/migrations/`. Numbered SQL files run in order.

### Adding a New Migration

1. Create `NNN_description.sql` in the migrations directory (NNN = next number)
2. Write idempotent SQL (use `IF NOT EXISTS` where possible)
3. Add a corresponding rollback in `NNN_description.down.sql`
4. Run `pnpm db:migrate`

---

## Logs

In development (`LOG_FORMAT=pretty`), logs are human-readable via Pino pretty-print.

In production (`LOG_FORMAT=json`), logs are structured JSON, suitable for log aggregation.

### Correlation IDs

Every request and every agent run has a `correlationId`. All logs within that operation include the correlation ID for tracing.

### Log Levels

```bash
LOG_LEVEL=trace   # Everything including DB queries (very verbose)
LOG_LEVEL=debug   # LLM requests/responses, job processing
LOG_LEVEL=info    # Default — agent decisions, publish events, errors
LOG_LEVEL=warn    # Warnings and errors only
LOG_LEVEL=error   # Errors only
```

---

## Monitoring (Production)

### Health Endpoint

```
GET /api/health
```

Returns system health including:
- Database connection status
- Redis connection status
- LLM provider status
- Instagram connection status
- Storage status
- Agent current state
- Queue depths

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|----------------|
| Queue depth > 100 | Warning |
| Queue depth > 500 | Critical |
| Publishing failure rate > 10% | Warning |
| LLM latency p99 > 30s | Warning |
| DB connection pool exhausted | Critical |
| Token expires in < 7 days | Warning |

---

## Security

### Secrets Management

- All secrets in environment variables — never in code or database
- `ENCRYPTION_KEY` encrypts OAuth tokens — back this up securely
- `JWT_SECRET` signs admin tokens — rotate if compromised
- Social tokens encrypted with AES-256-GCM at rest

### Token Rotation

If `ENCRYPTION_KEY` needs to be rotated:
1. Generate new key
2. Decrypt all existing tokens with old key
3. Re-encrypt with new key
4. Update environment variable

(A utility script for this will be provided in future versions.)

---

## Backup

### Database Backup

```bash
# Manual backup
docker exec evolvr-postgres pg_dump -U evolvr evolvr > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i evolvr-postgres psql -U evolvr evolvr < backup_20260901.sql
```

In production, use your hosting provider's automated backup solution.

### Critical Data to Protect

1. `social_accounts.access_token_encrypted` (and the `ENCRYPTION_KEY` to decrypt)
2. All strategy history (never overwritten by design)
3. All post metrics (analytics history)
4. `agent_decisions` (audit log)

---

## Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `LOG_FORMAT=json`
- [ ] Set `SIMULATION_MODE=false`
- [ ] Set all required LLM provider keys
- [ ] Set Meta App credentials (production app, not dev-mode)
- [ ] Update `INSTAGRAM_REDIRECT_URI` to production domain
- [ ] Configure S3/R2 storage (`STORAGE_PROVIDER=r2` or `s3`)
- [ ] Set strong random `JWT_SECRET`
- [ ] Set strong random `ENCRYPTION_KEY` and back it up
- [ ] Configure reverse proxy (nginx/Cloudflare) with HTTPS
- [ ] Set up database backups
- [ ] Set up log aggregation
- [ ] Change default admin password immediately after first login
