import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Knex } from 'knex';
import { KNEX } from '../../database/knex';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(KNEX) private readonly db: Knex) {}

  @Get()
  @ApiOperation({ summary: 'Check API and database health' })
  @ApiOkResponse({ description: 'Database connection is available.', schema: { example: { status: 'ok' } } })
  @ApiResponse({ status: 503, description: 'Database connectivity check failed.' })
  async health(): Promise<{ status: 'ok' }> {
    try {
      await this.db.raw('select 1');
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database connectivity check failed');
    }
  }
}
