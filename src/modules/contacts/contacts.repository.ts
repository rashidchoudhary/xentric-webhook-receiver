import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { KNEX } from '../../database/knex';
import type { ContactRecord } from './contacts.types';

@Injectable()
export class ContactsRepository {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async findPage(clientId: string, page: number, limit: number): Promise<ContactRecord[]> {
    const offset = (page - 1) * limit;

    return this.db.transaction(async (trx) => {
      // The request tenant is passed to PostgreSQL; the RLS policy is the actual tenant filter.
      await trx.raw("select set_config('app.current_client', ?, true)", [clientId]);

      return trx<ContactRecord>('contacts')
        .select([
          'client_id',
          'contact_id',
          'email',
          'phone',
          'first_name',
          'last_name',
          'status',
          'updated_at',
          'created_at',
          'modified_at'
        ])
        .orderBy('updated_at', 'desc')
        .offset(offset)
        .limit(limit);
    });
  }
}
