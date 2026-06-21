# Xentric AI Webhook Receiver

Production-grade multi-tenant CRM webhook receiver built with NestJS, the Fastify adapter, Knex, PostgreSQL 16, Pino, Vitest, and Supertest.

The code intentionally keeps standard NestJS structure: controllers receive HTTP requests, services own business decisions, repositories isolate Knex/PostgreSQL access, DTOs validate inputs, and guards handle bearer authentication. Fastify is used because the assignment requires it, but Fastify-specific code is isolated to `main.ts` and test bootstrap for raw-body HMAC verification.

## Architecture

Request flow:

1. CRM sends `POST /webhooks/crm/contact-updated` with tenant, event id, and HMAC signature headers.
2. The Fastify raw-body plugin preserves the exact request bytes.
3. `WebhookService` verifies the HMAC using the tenant secret and `crypto.timingSafeEqual()`.
4. `WebhookRepository` opens one PostgreSQL transaction, sets `app.current_client`, inserts into `processed_events`, and atomically upserts the contact.
5. PostgreSQL guarantees idempotency, ordering, and concurrency safety.
6. `LoggerService` emits exactly one structured Pino JSON log with a webhook disposition.

Read flow:

1. Client calls `GET /contacts/:client_id` with a bearer token.
2. `AuthGuard` maps token to tenant.
3. `ContactsService` rejects cross-tenant URL access with `403`.
4. `ContactsRepository` sets `app.current_client` and queries `contacts` without an application-level tenant `WHERE` filter.
5. PostgreSQL RLS enforces tenant isolation at the database layer.

## Why Fastify

The assignment mandates NestJS with the Fastify adapter. If you know Nest with Express, almost everything here remains familiar: modules, controllers, providers, guards, validation pipes, DTOs, and dependency injection work the same way. The only meaningful Fastify-specific piece is raw-body capture for signature verification.

## Why Knex

Knex gives explicit SQL control without using a banned ORM. That matters here because the core behavior depends on PostgreSQL features: composite keys, `INSERT ... ON CONFLICT`, transaction-local settings, least-privilege roles, and row-level security policies.

## Database Design

`contacts` uses `(client_id, contact_id)` as a composite primary key because contact ids are only unique within a CRM tenant. It stores contact fields, source `updated_at`, and operational timestamps.

`processed_events` stores each webhook event id once. This is durable idempotency: duplicate deliveries are ignored even after process restarts or horizontal scaling.

Indexes:

- `contacts(client_id)` supports tenant-oriented reads and RLS checks.
- `contacts(updated_at)` supports ordering by newest contacts.
- `processed_events(client_id)` supports auditing or future tenant-level inspection.

## Idempotency Strategy

Webhook processing runs in one transaction:

1. Insert `event_id` into `processed_events` with `ON CONFLICT DO NOTHING`.
2. If no row was inserted, the event was already handled and the contact is not touched.
3. If inserted, continue to the contact upsert.

This gives exactly one database mutation path per event id without in-memory state, Redis, or external locks.

## Concurrency Strategy

The contact write uses PostgreSQL atomic upsert:

```sql
INSERT INTO contacts (...)
VALUES (...)
ON CONFLICT (client_id, contact_id)
DO UPDATE SET ...
WHERE excluded.updated_at > contacts.updated_at;
```

The timestamp comparison happens inside PostgreSQL during the conflicting write. Concurrent deliveries for the same contact cannot corrupt state because PostgreSQL serializes the conflicting row update and only the newest event wins.

## Row Level Security

The application connects as `app_user`, not `postgres`. Migrations create RLS policies on `contacts` and grant only the required privileges.

Before tenant-scoped operations, the app executes:

```sql
SET LOCAL app.current_client = '<client_id>';
```

RLS policies compare `contacts.client_id` against `current_setting('app.current_client', true)`. The read endpoint deliberately does not add `WHERE client_id = ...`; the database is the enforcement boundary.

## Security Considerations

- HMAC-SHA256 is calculated over the raw request body.
- Signature comparison uses `crypto.timingSafeEqual()`.
- Unknown clients or missing signatures return `401`.
- Bearer tokens map to tenants and cross-tenant reads return `403`.
- PostgreSQL RLS protects tenant data even if an application query forgets tenant filtering.
- The app role is non-superuser and only receives required table permissions.
- DTO validation rejects malformed inputs and unknown body fields.

## Structured Logging

Every webhook emits exactly one JSON log entry with one of these dispositions:

- `processed`
- `duplicate_ignored`
- `out_of_order_ignored`
- `signature_invalid`
- `error`

Log fields include `event_id`, `client_id`, `contact_id`, `disposition`, and an ISO timestamp.

## Local Setup

Prerequisites:

- Node.js 22+
- npm
- Docker and Docker Compose

Create a local `.env` from the example if running outside Docker:

```bash
cp .env.example .env
```

Start everything with Docker:

```bash
docker compose up --build
```

The API is available at:

```text
http://localhost:3000
```

## Running Without Docker

Start PostgreSQL 16 locally with database `webhooks`, then set:

```bash
DATABASE_URL=postgres://app_user:app_password@localhost:5432/webhooks
MIGRATION_DATABASE_URL=postgres://postgres:postgres@localhost:5432/webhooks
APP_DB_USER=app_user
APP_DB_PASSWORD=app_password
CLIENT_A_SECRET=client-a-secret
CLIENT_B_SECRET=client-b-secret
CLIENT_A_TOKEN=client-a-token
CLIENT_B_TOKEN=client-b-token
```

Then run:

```bash
npm install
npm run migrate
npm run start:dev
```

## Running Tests

Tests are integration tests against real PostgreSQL. With PostgreSQL running locally:

```bash
npm test
```

The test suite runs migrations, truncates tables between tests, verifies HTTP behavior, checks database state, exercises concurrency, and proves RLS isolation using direct `app_user` queries.


## Swagger API Testing

When the API is running, open Swagger UI here:

```text
http://localhost:3000/docs
```

Use the **Authorize** button with this bearer token for `client_a`:

```text
client-a-token
```

For webhook testing in Swagger, you still need to generate a valid `X-CRM-Signature` for the exact JSON body you submit. The README curl example shows how to generate the signature with Node.

## Example Requests

Health:

```bash
curl http://localhost:3000/health
```

Webhook signature example with Node:

```bash
BODY='{"contact_id":"contact-1","email":"ada@example.com","phone":null,"first_name":"Ada","last_name":"Lovelace","status":"active","updated_at":"2026-06-20T10:00:00.000Z"}'
SIG=$(node -e "const crypto=require('crypto'); const body=process.argv[1]; console.log(crypto.createHmac('sha256','client-a-secret').update(body).digest('hex'))" "$BODY")
curl -X POST http://localhost:3000/webhooks/crm/contact-updated \
  -H "content-type: application/json" \
  -H "x-crm-client-id: client_a" \
  -H "x-crm-event-id: 11111111-1111-4111-8111-111111111111" \
  -H "x-crm-signature: $SIG" \
  -d "$BODY"
```

Read contacts:

```bash
curl http://localhost:3000/contacts/client_a?page=1\&limit=50 \
  -H "authorization: Bearer client-a-token"
```

## Trade-offs and Constraints

- Offset pagination is used because the assignment requires it; cursor pagination would scale better for high-volume production reads.
- Client configuration is environment-variable based for assignment clarity; production systems should use managed secrets.
- The sample supports `client_a` and `client_b`; adding tenants means adding token/secret config or replacing this with a tenant config store.
- Metrics and alerting are described but not included to keep the implementation focused on the required backend correctness.

## Future Improvements

- Prometheus/OpenTelemetry metrics for webhook dispositions, latency, and DB errors.
- Rate limiting per tenant.
- Audit log table for security-relevant read/write events.
- Schema versioning for webhook payload evolution.
- Dead-letter handling for malformed third-party events.
- Managed secret rotation and tenant onboarding workflow.
- Read replicas or cursor pagination for large contact datasets.

## Production Hardening

For a real deployment, use managed PostgreSQL, TLS everywhere, secret management, structured log shipping, alerting on `signature_invalid` spikes, migration approval gates, database backup/restore drills, and connection-pool sizing based on workload tests.

