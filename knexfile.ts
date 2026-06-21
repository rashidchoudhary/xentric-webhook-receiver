import 'dotenv/config';
import type { Knex } from 'knex';

const connection = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connection) {
  throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL must be set');
}

const config: Knex.Config = {
  client: 'pg',
  connection,
  migrations: {
    directory: './database/migrations',
    extension: 'ts'
  },
  pool: {
    min: 0,
    max: 5
  }
};

export default config;
