import { knex, type Knex } from 'knex';

export const KNEX = Symbol('KNEX');

export function createKnex(): Knex {
  const connection = process.env.DATABASE_URL;

  if (!connection) {
    throw new Error('DATABASE_URL must be set');
  }

  return knex({
    client: 'pg',
    connection,
    pool: {
      min: 0,
      max: Number(process.env.DB_POOL_MAX ?? 10)
    }
  });
}
