import { Controller, Post, Body, Param } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ValeryService } from '../valery/valery.service';
import { ValeryChatbotService } from '../valery/valery-chatbot.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly valeryService: ValeryService,
    private readonly valeryChatbotService: ValeryChatbotService
  ) {}

  @Post(':chatbotId/message')
  async sendMessage(
    @Param('chatbotId') chatbotId: string,
    @Body() messageDto: { message: string; from: string }
  ) {
    try {
      // Verificar si es un chatbot de tipo Valery
      const chatbot = await this.chatService.getChatbotById(chatbotId);
      if (chatbot && chatbot.settings?.type === 'valery') {
        // Usar el nuevo servicio de chatbot de Valery
        const response = await this.valeryChatbotService.handleMessage(
          messageDto.message,
          messageDto.from,
          chatbotId
        );
        return { response };
      }

      // Comportamiento existente para otros tipos de chatbot
      // ... existing code ...
    } catch (error) {
      // ... existing error handling ...
    }
  }
} 