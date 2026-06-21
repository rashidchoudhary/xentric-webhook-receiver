import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WebhookController } from './webhook.controller';
import { SignatureService } from './signature.service';
import { WebhookRepository } from './webhook.repository';
import { WebhookService } from './webhook.service';

@Module({
  imports: [AuthModule],
  controllers: [WebhookController],
  providers: [SignatureService, WebhookRepository, WebhookService]
})
export class WebhookModule {}
