import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { LoggerService } from '../../common/logger/logger.service';
import { SignatureService } from './signature.service';
import { WebhookRepository } from './webhook.repository';
import type { WebhookPayloadDto } from './dto/webhook-payload.dto';
import type { WebhookProcessResult } from './webhook.types';

export interface WebhookHeaders {
  signature: string | undefined;
  eventId: string | undefined;
  clientId: string | undefined;
}

export interface WebhookHandleResult {
  authorized: boolean;
  disposition?: WebhookProcessResult;
}

@Injectable()
export class WebhookService {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(SignatureService) private readonly signatureService: SignatureService,
    @Inject(WebhookRepository) private readonly repository: WebhookRepository,
    @Inject(LoggerService) private readonly logger: LoggerService
  ) {}

  async handle(headers: WebhookHeaders, payload: WebhookPayloadDto, rawBody: Buffer): Promise<WebhookHandleResult> {
    const timestamp = new Date().toISOString();
    const baseLog = {
      event_id: headers.eventId ?? null,
      client_id: headers.clientId ?? null,
      contact_id: payload.contact_id,
      timestamp
    };

    try {
      const secret = headers.clientId ? this.authService.getSecret(headers.clientId) : null;
      const signatureValid = secret ? this.signatureService.verify(rawBody, headers.signature, secret) : false;

      if (!headers.eventId || !headers.clientId || !signatureValid) {
        this.logger.webhook({ ...baseLog, disposition: 'signature_invalid' });
        return { authorized: false };
      }

      const disposition = await this.repository.process({
        clientId: headers.clientId,
        eventId: headers.eventId,
        contactId: payload.contact_id,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        firstName: payload.first_name ?? null,
        lastName: payload.last_name ?? null,
        status: payload.status,
        updatedAt: payload.updated_at
      });

      this.logger.webhook({ ...baseLog, event_id: headers.eventId, client_id: headers.clientId, disposition });
      return { authorized: true, disposition };
    } catch (error) {
      this.logger.webhook({
        ...baseLog,
        disposition: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}
