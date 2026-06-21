import { Controller, Get, Inject, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard';
import { ContactsService } from './contacts.service';
import { ContactsQueryDto } from './dto/contacts-query.dto';
import type { PaginatedContacts } from './contacts.types';

@ApiTags('Contacts')
@Controller('contacts')
export class ContactsController {
  constructor(@Inject(ContactsService) private readonly contactsService: ContactsService) {}

  @Get(':client_id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List contacts for a tenant using PostgreSQL RLS isolation' })
  @ApiParam({ name: 'client_id', example: 'client_a' })
  @ApiOkResponse({
    description: 'Paginated contacts for the authenticated tenant.',
    schema: {
      example: {
        data: [
          {
            client_id: 'client_a',
            contact_id: 'contact-1',
            email: 'ada@example.com',
            phone: '+15550000001',
            first_name: 'Ada',
            last_name: 'Lovelace',
            status: 'active',
            updated_at: '2026-06-20T10:00:00.000Z',
            created_at: '2026-06-21T09:00:00.000Z',
            modified_at: '2026-06-21T09:00:00.000Z'
          }
        ],
        page: 1,
        limit: 50
      }
    }
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid bearer token.' })
  @ApiResponse({ status: 403, description: 'Token tenant does not match the requested client_id.' })
  async list(
    @Param('client_id') clientId: string,
    @Query() query: ContactsQueryDto,
    @Req() request: AuthenticatedRequest
  ): Promise<PaginatedContacts> {
    return this.contactsService.list(clientId, request.client.clientId, query.page, query.limit);
  }
}
