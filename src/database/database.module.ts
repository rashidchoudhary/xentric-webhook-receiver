import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Knex } from 'knex';
import { createKnex, KNEX } from './knex';

@Global()
@Module({
  providers: [
    {
      provide: KNEX,
      useFactory: createKnex
    }
  ],
  exports: [KNEX]
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  async onApplicationShutdown(): Promise<void> {
    await this.db.destroy();
  }
}

export type { Knex };
