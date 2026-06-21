import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../../database/knex';
import type { ContactEvent, WebhookProcessResult } from './webhook.types';

interface ProcessedEventRow {
  event_id: string;
  client_id: string;
  received_at: Date;
}

interface ContactTableRow {
  client_id: string;
  contact_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  updated_at: string | Date;
  created_at: Date;
  modified_at: Knex.Raw | Date;
}

@Injectable()
export class WebhookRepository {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async process(event: ContactEvent): Promise<WebhookProcessResult> {
    return this.db.transaction(async (trx) => {
      await trx.raw("select set_config('app.current_client', ?, true)", [event.clientId]);

      const insertedEvents = await trx<ProcessedEventRow>('processed_events')
        .insert({ event_id: event.eventId, client_id: event.clientId })
        .onConflict('event_id')
        .ignore()
        .returning('event_id');

      if (insertedEvents.length === 0) {
        return 'duplicate_ignored';
      }

      // PostgreSQL performs the timestamp comparison inside the upsert, so racing deliveries cannot overwrite newer state.
      const upserted = await trx<ContactTableRow>('contacts')
        .insert({
          client_id: event.clientId,
          contact_id: event.contactId,
          email: event.email,
          phone: event.phone,
          first_name: event.firstName,
          last_name: event.lastName,
          status: event.status,
          updated_at: event.updatedAt,
          modified_at: trx.fn.now()
        })
        .onConflict(['client_id', 'contact_id'])
        .merge({
          email: event.email,
          phone: event.phone,
          first_name: event.firstName,
          last_name: event.lastName,
          status: event.status,
          updated_at: event.updatedAt,
          modified_at: trx.fn.now()
        })
        .whereRaw('excluded.updated_at > contacts.updated_at')
        .returning('contact_id');

      return upserted.length === 0 ? 'out_of_order_ignored' : 'processed';
    });
  }
}
