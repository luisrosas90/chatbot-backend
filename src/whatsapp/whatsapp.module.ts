/**
 * Módulo que maneja la integración con WhatsApp.
 * Este módulo proporciona:
 * - Controlador para manejar webhooks y mensajes
 * - Servicio para interactuar con la API de WhatsApp
 * - Configuración de conexión a la base de datos
 * 
 * @module WhatsappModule
 */
import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { EvolutionApiProvider } from './providers/evolution-api.provider';
import { WabaSmsProvider } from './providers/waba-sms.provider';
import { ChatModule } from '../chat/chat.module';
import { MediaModule } from '../media/media.module';
import { ValeryModule } from '../valery/valery.module';
import { Chatbot } from '../admin/entities/chatbot.entity';

@Module({
  imports: [
    ConfigModule,
    MediaModule,
    forwardRef(() => ChatModule),
    forwardRef(() => ValeryModule),
    TypeOrmModule.forFeature([Chatbot], 'users'),
  ],
  controllers: [WhatsappController],
  providers: [
    WhatsappService,
    {
      provide: 'WHATSAPP_PROVIDERS',
      useFactory: (configService: ConfigService) => ({
        'evolution-api': new EvolutionApiProvider(configService),
        'waba-sms': new WabaSmsProvider(configService)
      }),
      inject: [ConfigService]
    }
  ],
  exports: [WhatsappService]
})
export class WhatsappModule {} 