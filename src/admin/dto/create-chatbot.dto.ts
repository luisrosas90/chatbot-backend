import { IsString, IsBoolean, IsObject, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateChatbotDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsString()
  apiKey: string;

  @ApiProperty()
  @IsBoolean()
  isActive: boolean;

  @ApiProperty()
  @IsObject()
  settings: {
    welcomeMessage: string;
    fallbackMessage: string;
    maxRetries: number;
    timeout: number;
    language: string;
    whatsapp: {
      instanceId: string;
      provider: 'evolution-api' | 'waba-sms';
      apiUrl: string;
      apiKey: string;
      webhookUrl?: string;
      webhookEvents?: string[];
      webhookSecret?: string;
    };
  };
} 