/**
 * Módulo que maneja las sesiones y mensajes de chat.
 * Este módulo proporciona:
 * - Servicio para gestionar sesiones y mensajes
 * - Entidades para almacenar datos de chat
 * - Integración con servicios de IA
 * - Sistema de plantillas de mensajes
 * - Respuestas automáticas inteligentes
 * - Persistencia de búsquedas y carritos de compras
 * 
 * @module ChatModule
 */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ChatService } from './chat.service';
import { ChatSession } from './entities/chat-session.entity';
import { ChatMessage } from './entities/message.entity';
import { MessageTemplate } from './entities/message-template.entity';
import { PersistentSession } from './entities/persistent-session.entity';
import { SearchHistory } from './entities/search-history.entity';
import { ShoppingCart } from './entities/shopping-cart.entity';
import { TemplateService } from './services/template.service';
import { AutoResponseService } from './services/auto-response.service';
import { AiModule } from '../ai/ai.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ValeryModule } from '../valery/valery.module';
import { Chatbot } from '../admin/entities/chatbot.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      ChatSession, 
      ChatMessage, 
      MessageTemplate,
      PersistentSession,
      SearchHistory,
      ShoppingCart,
      Chatbot
    ], 'users'),
    AiModule,
    ValeryModule,
    forwardRef(() => WhatsappModule),
  ],
  providers: [
    ChatService,
    TemplateService,
    AutoResponseService
  ],
  exports: [
    ChatService,
    TemplateService,
    AutoResponseService
  ],
})
export class ChatModule {} 