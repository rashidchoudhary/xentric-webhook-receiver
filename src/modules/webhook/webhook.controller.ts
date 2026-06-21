import { Body, Controller, Headers, HttpCode, Inject, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBody, ApiHeader, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { WebhookService } from './webhook.service';

interface RawFastifyRequest extends RawBodyRequest<FastifyRequest> {
  rawBody: Buffer;
}

@ApiTags('Webhooks')
@Controller('webhooks/crm')
export class WebhookController {
  constructor(@Inject(WebhookService) private readonly webhookService: WebhookService) {}

  @Post('contact-updated')
  @HttpCode(200)
  @ApiOperation({ summary: 'Receive a CRM contact update webhook' })
  @ApiHeader({ name: 'X-CRM-Signature', description: 'HMAC-SHA256 signature of the raw JSON body. Use the tenant secret, for example client-a-secret.', example: 'generated-hmac-hex' })
  @ApiHeader({ name: 'X-CRM-Event-Id', description: 'Unique UUID for idempotency.', example: '11111111-1111-4111-8111-111111111111' })
  @ApiHeader({ name: 'X-CRM-Client-Id', description: 'Tenant/client identifier.', example: 'client_a' })
  @ApiBody({ type: WebhookPayloadDto })
  @ApiOkResponse({ description: 'Webhook accepted, duplicate ignored, or out-of-order event ignored.', schema: { example: { status: 'ok' } } })
  @ApiResponse({ status: 401, description: 'Invalid or missing HMAC signature.' })
  async contactUpdated(
    @Req() request: RawFastifyRequest,
    @Body() payload: WebhookPayloadDto,
    @Headers('x-crm-signature') signature: string | undefined,
    @Headers('x-crm-event-id') eventId: string | undefined,
    @Headers('x-crm-client-id') clientId: string | undefined
  ): Promise<{ status: 'ok' }> {
    const result = await this.webhookService.handle(
      { signature, eventId, clientId },
      payload,
      request.rawBody ?? Buffer.from(JSON.stringify(payload))
    );

    if (!result.authorized) {
      throw new UnauthorizedException('Invalid CRM signature');
    }

    return { status: 'ok' };
  }
}
