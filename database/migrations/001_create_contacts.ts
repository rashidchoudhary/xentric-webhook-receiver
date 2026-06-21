import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('contacts', (table) => {
    table.text('client_id').notNullable();
    table.text('contact_id').notNullable();
    table.text('email').nullable();
    table.text('phone').nullable();
    table.text('first_name').nullable();
    table.text('last_name').nullable();
    table.text('status').notNullable();
    table.timestamp('updated_at', { useTz: true }).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('modified_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(['client_id', 'contact_id']);
    table.index(['client_id'], 'idx_contacts_client_id');
    table.index(['updated_at'], 'idx_contacts_updated_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('contacts');
}
