/**
 * Módulo que maneja las interacciones con servicios de IA.
 * Este módulo proporciona:
 * - Servicio para generar respuestas de chat
 * - Servicio para transcribir audio
 * - Servicio para analizar imágenes
 * - Configuración de APIs de OpenAI
 * 
 * @module AiModule
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AiService } from './ai.service';
import { OpenAIService } from './openai.service';
import { AnthropicService } from './anthropic.service';
import { GoogleAIService } from './google-ai.service';
import { OllamaService } from './ollama.service';
import { ChatSession } from '../chat/entities/chat-session.entity';
import { ChatMessage } from '../chat/entities/message.entity';
import { User } from '../users/entities/user.entity';
import { Chatbot } from '../admin/entities/chatbot.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      ChatSession,
      ChatMessage,
      User,
      Chatbot
    ], 'users')
  ],
  providers: [
    AiService,
    OpenAIService,
    AnthropicService,
    GoogleAIService,
    OllamaService
  ],
  exports: [AiService]
})
export class AiModule {} 