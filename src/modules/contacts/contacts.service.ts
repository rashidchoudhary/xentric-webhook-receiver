import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ContactsRepository } from './contacts.repository';
import type { PaginatedContacts } from './contacts.types';

@Injectable()
export class ContactsService {
  constructor(@Inject(ContactsRepository) private readonly repository: ContactsRepository) {}

  async list(clientId: string, authenticatedClientId: string, page: number, limit: number): Promise<PaginatedContacts> {
    if (clientId !== authenticatedClientId) {
      throw new ForbiddenException('Token cannot access requested tenant');
    }

    const cappedLimit = Math.min(limit, 100);
    const data = await this.repository.findPage(clientId, page, cappedLimit);
    return { data, page, limit: cappedLimit };
  }
}
