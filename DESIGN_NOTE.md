Key design notes (how this maps to your blueprint)

API route placement

All API endpoints live under src/app/api/v1/... (App Router) or src/pages/api/v1/... (Pages Router). Each route file is a thin handler that:

runs request validation with Zod (from src/lib/validators),

runs jwtAuth middleware to assert the caller,

runs idempotency middleware when required (checks/stores X-Request-ID),

calls a domain service (e.g., trade.service) which executes DB transactions.

OpenAPI

openapi/openapi.yaml is authoritative. Generate it from code-first tools or maintain by hand. CI job should validate it (openapi-validator) and surface mismatches.

Supabase / DB

supabase/migrations/ contains all DDL files you asked for (users, crypto_assets, fiat_wallets, crypto_wallets, trade_transactions, bill_payments, audit_logs) plus separate RLS policy scripts (008_rls_policies.sql). Use Supabase CLI or pg-migrate to apply them. Keep DDL in sql/ddl/ as canonical reference.

Validation

Zod schemas per endpoint are in src/lib/validators and are used both in runtime request validation and to generate TypeScript types (avoid duplication).

Services and Transaction Boundaries

Business logic and database transactions live in src/lib/services/\*.ts. Example: trade.service.ts must:

Validate funds (SELECT FOR UPDATE),

Insert a trade_transactions row,

Debit / Credit ledger rows or wallet balances,

Commit only if all succeed,

Emit audit_log entry.

Keep raw SQL in src/lib/db for performance and clarity (use parameterized queries).

Idempotency

src/lib/middlewares/idempotency.ts and src/lib/services/idempotency.ts implement X-Request-ID checks:

DB table idempotency_keys with columns (idempotency_key, user_id, request_hash, response_body, created_at, expires_at, status).

Insert unique key; if exists return stored response or error; otherwise proceed and store response atomically.

Rate limiting

src/lib/middlewares/rateLimit.ts wraps critical endpoints:

Uses Upstash Redis or self-hosted Redis with short TTL counters per user+route and a separate global key for IP-based throttling.

Config file src/config/rate-limits.json defines tiers (e.g., trade: 60 req/min for basic, 300 req/min for verified).

Auth / JWT middleware

src/lib/middlewares/jwtAuth.ts verifies Supabase JWT (or Supabase cookie) on server side:

Canonical flow: Supabase issues JWT via Auth; Next.js verifies token signature using Supabase JWKS (or service role for server-to-server).

jwtAuth attaches req.user = { id: uuid, email, role } to enforce RLS and supply auth.uid() context when using Supabase client.

RLS & Policies

supabase/migrations/008_rls_policies.sql contains RLS policies for fiat_wallets and crypto_wallets:

Example policy: CREATE POLICY "wallet_owner" ON fiat_wallets FOR ALL USING (user_id = auth.uid());

Keep service_role queries for backend jobs / migrations but do NOT use service_role in public API handlers.

Tests & CI

Unit tests for services (wallets, trades, bills) in src/tests/unit.

Integration tests (end-to-end) run in CI using a test Supabase instance (or Docker Postgres with the same DDL).

CI pipeline runs migrations in ephemeral DB, runs tests, lints, and validates OpenAPI file.

Docs & Runbooks

docs/SECURITY.md must describe secrets handling, key rotation, incident response (withdrawal anomalies), and contact/escrow procedures.

Files you should create first (priority)

openapi/openapi.yaml — add the endpoints listed in your prompt (auth, wallets, exchange, bills).

supabase/migrations/001_create_users.sql — create users table and minimal KYC fields.

supabase/migrations/005_create_trade_transactions.sql — ledger table + indexing for idempotency and performance.

src/lib/middlewares/jwtAuth.ts and src/lib/validators/trade.schema.ts.

src/app/api/v1/exchange/trade.route.ts — initial handler wiring validator → idempotency → jwtAuth → trade.service.

src/lib/services/trade.service.ts — implement DB transaction skeleton (SELECT FOR UPDATE, balance checks, insert trade).

Minimal example: where the /api/v1/exchange/trade flow lives

src/app/api/v1/exchange/trade.route.ts — receives POST, reads X-Request-ID.

src/lib/validators/trade.schema.ts — Zod schema: { pair: string, type: enum('BUY','SELL'), amount: number }.

src/lib/middlewares/jwtAuth.ts — verify token; set user_id.

src/lib/middlewares/idempotency.ts — check/insert idempotency key.

src/lib/services/trade.service.ts — executes the trade in an atomic DB transaction; writes trade_transactions, adjusts ledger, writes audit_logs.

Security & operational files (must-have)

.env.example (show variables but not values): SUPABASE_URL, SUPABASE_ANON_KEY, UPSTASH_REDIS_URL (note: do not store service_role in public envs).

docs/SECURITY.md — secret storage policy (Supabase Vault or AWS Secrets Manager), rotation schedule, CI secrets usage.

supabase/migrations/008_rls_policies.sql — contains RLS policies you asked for.

README.md — how to run migrations, local dev, and run tests.

Final tips & conventions

Keep API handlers extremely thin; all heavy logic in services/.

Use numeric(24,10) for crypto and numeric(24,4) for fiat in your DDL (place DDL in supabase/migrations).

All financial mutations must be executed inside a DB transaction and produce an audit log row atomically.

Never use Supabase service_role key in client-defined API routes — only server-side background jobs and migrations may use it.

Maintain openapi/openapi.yaml as source of truth and validate it in CI.

RLS policies + middleware + well-scoped service_role usage == strong security posture.
