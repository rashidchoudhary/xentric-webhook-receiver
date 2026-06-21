import { Injectable } from '@nestjs/common';
import pino, { type Logger } from 'pino';

export type WebhookDisposition =
  | 'processed'
  | 'duplicate_ignored'
  | 'out_of_order_ignored'
  | 'signature_invalid'
  | 'error';

export interface WebhookLogFields {
  event_id: string | null;
  client_id: string | null;
  contact_id?: string;
  disposition: WebhookDisposition;
  timestamp: string;
  error_message?: string;
}

@Injectable()
export class LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime
  });

  webhook(fields: WebhookLogFields): void {
    const level = fields.disposition === 'error' || fields.disposition === 'signature_invalid' ? 'warn' : 'info';
    this.logger[level]({ ...fields }, 'webhook_disposition');
  }

  info(fields: Record<string, unknown>, message: string): void {
    this.logger.info(fields, message);
  }

  error(fields: Record<string, unknown>, message: string): void {
    this.logger.error(fields, message);
  }
}
