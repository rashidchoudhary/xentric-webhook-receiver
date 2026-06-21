import { createHmac, randomUUID } from 'node:crypto';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import type { Knex } from 'knex';
import knex from 'knex';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';
process.env.CLIENT_A_SECRET = process.env.CLIENT_A_SECRET ?? 'client-a-secret';
process.env.CLIENT_B_SECRET = process.env.CLIENT_B_SECRET ?? 'client-b-secret';
process.env.CLIENT_A_TOKEN = process.env.CLIENT_A_TOKEN ?? 'client-a-token';
process.env.CLIENT_B_TOKEN = process.env.CLIENT_B_TOKEN ?? 'client-b-token';
process.env.APP_DB_USER = process.env.APP_DB_USER ?? 'app_user';
process.env.APP_DB_PASSWORD = process.env.APP_DB_PASSWORD ?? 'app_password';
process.env.MIGRATION_DATABASE_URL = process.env.MIGRATION_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/webhooks';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://app_user:app_password@localhost:5432/webhooks';

interface ContactRow {
  client_id: string;
  contact_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  updated_at: Date;
}

interface Payload {
  contact_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  updated_at: string;
}

const adminDb = knex({ client: 'pg', connection: process.env.MIGRATION_DATABASE_URL });
const appDb = knex({ client: 'pg', connection: process.env.DATABASE_URL });

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

function payload(overrides: Partial<Payload> = {}): Payload {
  return {
    contact_id: 'contact-1',
    email: 'ada@example.com',
    phone: '+15550000001',
    first_name: 'Ada',
    last_name: 'Lovelace',
    status: 'active',
    updated_at: '2026-06-20T10:00:00.000Z',
    ...overrides
  };
}

function sendWebhook(baseUrl: string | undefined, eventPayload: Payload, eventId = randomUUID()) {
  if (!baseUrl) {
    throw new Error('Test app was not initialized');
  }

  const body = JSON.stringify(eventPayload);
  return request(baseUrl)
    .post('/webhooks/crm/contact-updated')
    .set('content-type', 'application/json')
    .set('x-crm-client-id', 'client_a')
    .set('x-crm-event-id', eventId)
    .set('x-crm-signature', sign(body, process.env.CLIENT_A_SECRET ?? 'client-a-secret'))
    .send(body);
}

async function getContact(db: Knex, clientId: string, contactId: string): Promise<ContactRow | undefined> {
  return db<ContactRow>('contacts').where({ client_id: clientId, contact_id: contactId }).first();
}

describe('webhook receiver integration', () => {
  let app: NestFastifyApplication | undefined;
  let baseUrl: string | undefined;

  beforeAll(async () => {
    await adminDb.migrate.latest({ directory: './database/migrations', extension: 'ts' });

    const adapter = new FastifyAdapter({ logger: false });

    app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: false, rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(async () => {
    await adminDb.raw('TRUNCATE TABLE processed_events, contacts');
  });

  afterAll(async () => {
    await app?.close();
    await adminDb.destroy();
    await appDb.destroy();
  });

  it('returns health after checking database connectivity', async () => {
    await request(baseUrl ?? '').get('/health').expect(200).expect({ status: 'ok' });
  });

  it('processes a valid webhook and stores the contact', async () => {
    await sendWebhook(baseUrl, payload()).expect(200).expect({ status: 'ok' });

    const stored = await getContact(adminDb, 'client_a', 'contact-1');
    expect(stored?.email).toBe('ada@example.com');
    expect(stored?.status).toBe('active');
  });

  it('returns 401 for invalid signatures', async () => {
    const body = JSON.stringify(payload());

    await request(baseUrl ?? '')
      .post('/webhooks/crm/contact-updated')
      .set('content-type', 'application/json')
      .set('x-crm-client-id', 'client_a')
      .set('x-crm-event-id', randomUUID())
      .set('x-crm-signature', 'bad-signature')
      .send(body)
      .expect(401);

    const rows = await adminDb<ContactRow>('contacts');
    expect(rows).toHaveLength(0);
  });

  it('ignores duplicate event ids without mutating contacts again', async () => {
    const eventId = randomUUID();

    await sendWebhook(baseUrl, payload({ email: 'first@example.com' }), eventId).expect(200);
    await sendWebhook(baseUrl, payload({ email: 'second@example.com', updated_at: '2026-06-20T11:00:00.000Z' }), eventId).expect(200);

    const stored = await getContact(adminDb, 'client_a', 'contact-1');
    const events = await adminDb('processed_events').where({ event_id: eventId });
    expect(stored?.email).toBe('first@example.com');
    expect(events).toHaveLength(1);
  });

  it('ignores out-of-order events that are older than stored state', async () => {
    await sendWebhook(baseUrl, payload({ email: 'new@example.com', updated_at: '2026-06-20T10:00:00.000Z' })).expect(200);
    await sendWebhook(baseUrl, payload({ email: 'old@example.com', updated_at: '2026-06-20T09:00:00.000Z' })).expect(200);

    const stored = await getContact(adminDb, 'client_a', 'contact-1');
    expect(stored?.email).toBe('new@example.com');
  });

  it('handles concurrent updates with newest timestamp winning', async () => {
    const updates = [
      payload({ email: 'old@example.com', updated_at: '2026-06-20T08:00:00.000Z' }),
      payload({ email: 'newest@example.com', updated_at: '2026-06-20T12:00:00.000Z' }),
      payload({ email: 'middle@example.com', updated_at: '2026-06-20T10:00:00.000Z' })
    ];

    await Promise.all(updates.map((item) => sendWebhook(baseUrl, item).expect(200)));

    const stored = await getContact(adminDb, 'client_a', 'contact-1');
    expect(stored?.email).toBe('newest@example.com');
  });

  it('authenticates bearer tokens and returns paginated contacts', async () => {
    await sendWebhook(baseUrl, payload()).expect(200);

    const response = await request(baseUrl ?? '')
      .get('/contacts/client_a?page=1&limit=50')
      .set('authorization', `Bearer ${process.env.CLIENT_A_TOKEN}`)
      .expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].client_id).toBe('client_a');
  });

  it('returns 401 for invalid bearer tokens', async () => {
    await request(baseUrl ?? '')
      .get('/contacts/client_a')
      .set('authorization', 'Bearer invalid')
      .expect(401);
  });

  it('returns 403 when a token accesses another tenant', async () => {
    await request(baseUrl ?? '')
      .get('/contacts/client_b')
      .set('authorization', `Bearer ${process.env.CLIENT_A_TOKEN}`)
      .expect(403);
  });

  it('enforces tenant isolation through PostgreSQL RLS for direct app_user queries', async () => {
    await adminDb<ContactRow>('contacts').insert([
      {
        client_id: 'client_a',
        contact_id: 'a-1',
        email: 'a@example.com',
        phone: null,
        first_name: null,
        last_name: null,
        status: 'active',
        updated_at: new Date('2026-06-20T10:00:00.000Z')
      },
      {
        client_id: 'client_b',
        contact_id: 'b-1',
        email: 'b@example.com',
        phone: null,
        first_name: null,
        last_name: null,
        status: 'active',
        updated_at: new Date('2026-06-20T10:00:00.000Z')
      }
    ]);

    const rows = await appDb.transaction(async (trx) => {
      await trx.raw("select set_config('app.current_client', ?, true)", ['client_a']);
      return trx<ContactRow>('contacts').select('client_id', 'contact_id').orderBy('contact_id');
    });

    expect(rows).toEqual([{ client_id: 'client_a', contact_id: 'a-1' }]);
  });
});






