import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class WebhookPayloadDto {
  @ApiProperty({ example: 'contact-1' })
  @IsString()
  contact_id!: string;

  @ApiProperty({ example: 'ada@example.com', nullable: true })
  @IsOptional()
  @IsString()
  email!: string | null;

  @ApiProperty({ example: '+15550000001', nullable: true })
  @IsOptional()
  @IsString()
  phone!: string | null;

  @ApiProperty({ example: 'Ada', nullable: true })
  @IsOptional()
  @IsString()
  first_name!: string | null;

  @ApiProperty({ example: 'Lovelace', nullable: true })
  @IsOptional()
  @IsString()
  last_name!: string | null;

  @ApiProperty({ example: 'active' })
  @IsString()
  status!: string;

  @ApiProperty({ example: '2026-06-20T10:00:00.000Z', format: 'date-time' })
  @IsISO8601()
  updated_at!: string;
}
