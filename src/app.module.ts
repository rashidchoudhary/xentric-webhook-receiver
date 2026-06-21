import { Module } from '@nestjs/common';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { LoggerModule } from './common/logger/logger.module';
import { WebhookModule } from './modules/webhook/webhook.module';

@Module({
  imports: [LoggerModule, DatabaseModule, AuthModule, HealthModule, WebhookModule, ContactsModule]
})
export class AppModule {}
