import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('processed_events', (table) => {
    table.uuid('event_id').primary();
    table.text('client_id').notNullable();
    table.timestamp('received_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index(['client_id'], 'idx_processed_events_client_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('processed_events');
}
