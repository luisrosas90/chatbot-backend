/**
 * Servicio para manejar las interacciones con servicios de IA.
 * Este servicio proporciona funcionalidades para:
 * - Generar respuestas de chat usando modelos de lenguaje
 * - Transcribir audio usando Whisper
 * - Analizar imágenes usando Vision
 * 
 * @class AiService
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { ChatSession } from '../chat/entities/chat-session.entity';
import { ChatMessage } from '../chat/entities/message.entity';
import { User } from '../users/entities/user.entity';
import { Chatbot } from '../admin/entities/chatbot.entity';
import { OpenAIService } from './openai.service';
import { AnthropicService } from './anthropic.service';
import { GoogleAIService } from './google-ai.service';
import { OllamaService } from './ollama.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openaiApiKey: string;
  private readonly openaiApiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ChatSession, 'users')
    private readonly chatSessionRepository: Repository<ChatSession>,
    @InjectRepository(ChatMessage, 'users')
    private readonly messageRepository: Repository<ChatMessage>,
    @InjectRepository(User, 'users')
    private readonly userRepository: Repository<User>,
    @InjectRepository(Chatbot, 'users')
    private readonly chatbotRepository: Repository<Chatbot>,
    private readonly openAIService: OpenAIService,
    private readonly anthropicService: AnthropicService,
    private readonly googleAIService: GoogleAIService,
    private readonly ollamaService: OllamaService,
  ) {
    this.openaiApiKey = this.configService.get('ai.apiKey');
    this.openaiApiUrl = this.configService.get('ai.chatUrl');
  }

  /**
   * Genera una respuesta usando el modelo de chat de OpenAI.
   * 
   * @param {string} message - Mensaje del usuario
   * @param {ChatMessage[]} history - Historial de mensajes previos
   * @returns {Promise<string>} Respuesta generada
   * @throws {Error} Si hay un error al generar la respuesta
   */
  async generateResponse(message: string, history: ChatMessage[] = []): Promise<string> {
    try {
      const messages = history.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));

      messages.push({ role: 'user', content: message });

      const response = await axios.post(
        this.openaiApiUrl,
        {
          model: this.configService.get('ai.model'),
          messages: [
            {
              role: 'system',
              content: this.configService.get('ai.systemPrompt')
            },
            ...messages
          ],
          temperature: 0.7,
          max_tokens: 150
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Error generando respuesta: ${error.message}`);
      throw error;
    }
  }

  /**
   * Transcribe audio usando el modelo Whisper de OpenAI.
   * 
   * @param {Buffer} audioBuffer - Buffer del archivo de audio
   * @returns {Promise<string>} Texto transcrito
   * @throws {Error} Si hay un error en la transcripción
   */
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer]), 'audio.mp3');
      formData.append('model', 'whisper-1');

      const response = await axios.post(
        this.configService.get('ai.whisperUrl'),
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      return response.data.text;
    } catch (error) {
      this.logger.error(`Error transcribiendo audio: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analiza una imagen usando el modelo Vision de OpenAI.
   * 
   * @param {string} imageUrl - URL de la imagen a analizar
   * @returns {Promise<string>} Descripción de la imagen
   * @throws {Error} Si hay un error al analizar la imagen
   */
  async analyzeImage(imageUrl: string): Promise<string> {
    try {
      const response = await axios.post(
        this.openaiApiUrl,
        {
          model: 'gpt-4-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: '¿Qué hay en esta imagen?' },
                { type: 'image_url', image_url: imageUrl }
              ]
            }
          ],
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openaiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      this.logger.error(`Error analizando imagen: ${error.message}`);
      throw error;
    }
  }
} 