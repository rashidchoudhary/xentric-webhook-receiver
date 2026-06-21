import type { Knex } from 'knex';

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function up(knex: Knex): Promise<void> {
  const appUser = process.env.APP_DB_USER ?? 'app_user';
  const appPassword = process.env.APP_DB_PASSWORD ?? 'app_password';
  const roleIdentifier = quoteIdentifier(appUser);

  await knex.raw(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${quoteLiteral(appUser)}) THEN
        CREATE ROLE ${roleIdentifier} WITH LOGIN PASSWORD ${quoteLiteral(appPassword)};
      ELSE
        ALTER ROLE ${roleIdentifier} WITH LOGIN PASSWORD ${quoteLiteral(appPassword)};
      END IF;
    END
    $$;
  `);

  await knex.raw('ALTER TABLE contacts ENABLE ROW LEVEL SECURITY');
  await knex.raw('ALTER TABLE contacts FORCE ROW LEVEL SECURITY');
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_select ON contacts');
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_insert ON contacts');
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_update ON contacts');

  await knex.raw(`
    CREATE POLICY tenant_isolation_select ON contacts
    FOR SELECT
    USING (client_id = current_setting('app.current_client', true))
  `);
  await knex.raw(`
    CREATE POLICY tenant_isolation_insert ON contacts
    FOR INSERT
    WITH CHECK (client_id = current_setting('app.current_client', true))
  `);
  await knex.raw(`
    CREATE POLICY tenant_isolation_update ON contacts
    FOR UPDATE
    USING (client_id = current_setting('app.current_client', true))
    WITH CHECK (client_id = current_setting('app.current_client', true))
  `);

  await knex.raw(`GRANT USAGE ON SCHEMA public TO ${roleIdentifier}`);
  await knex.raw(`GRANT SELECT, INSERT, UPDATE ON contacts TO ${roleIdentifier}`);
  await knex.raw(`GRANT SELECT, INSERT, UPDATE ON processed_events TO ${roleIdentifier}`);
}

export async function down(knex: Knex): Promise<void> {
  const appUser = process.env.APP_DB_USER ?? 'app_user';
  const roleIdentifier = quoteIdentifier(appUser);

  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_select ON contacts');
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_insert ON contacts');
  await knex.raw('DROP POLICY IF EXISTS tenant_isolation_update ON contacts');
  await knex.raw('ALTER TABLE contacts DISABLE ROW LEVEL SECURITY');
  await knex.raw(`REVOKE SELECT, INSERT, UPDATE ON processed_events FROM ${roleIdentifier}`);
  await knex.raw(`REVOKE SELECT, INSERT, UPDATE ON contacts FROM ${roleIdentifier}`);
  await knex.raw(`REVOKE USAGE ON SCHEMA public FROM ${roleIdentifier}`);
}
