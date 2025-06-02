import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chatbot } from '../entities/chatbot.entity';
import { CreateChatbotDto } from '../dto/create-chatbot.dto';
import { UpdateChatbotDto } from '../dto/update-chatbot.dto';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);

  constructor(
    @InjectRepository(Chatbot, 'users')
    private chatbotRepository: Repository<Chatbot>
  ) {}

  async create(createChatbotDto: CreateChatbotDto): Promise<Chatbot> {
    try {
      const chatbot = this.chatbotRepository.create(createChatbotDto);
      return await this.chatbotRepository.save(chatbot);
    } catch (error) {
      this.logger.error(`Error al crear chatbot: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<Chatbot[]> {
    return await this.chatbotRepository.find({
      relations: ['conversations'],
    });
  }

  async findOne(id: string): Promise<Chatbot> {
    return await this.chatbotRepository.findOne({
      where: { id },
      relations: ['conversations'],
    });
  }

  async update(id: string, updateChatbotDto: UpdateChatbotDto): Promise<Chatbot> {
    try {
      const chatbot = await this.chatbotRepository.findOne({ where: { id } });
      if (!chatbot) {
        throw new Error('Chatbot no encontrado');
      }
      
      Object.assign(chatbot, updateChatbotDto);
      return await this.chatbotRepository.save(chatbot);
    } catch (error) {
      this.logger.error(`Error al actualizar chatbot: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.chatbotRepository.delete(id);
  }

  async toggleActive(id: string): Promise<Chatbot> {
    const chatbot = await this.findOne(id);
    chatbot.isActive = !chatbot.isActive;
    return await this.chatbotRepository.save(chatbot);
  }

  async updateSettings(id: string, settings: Partial<Chatbot['settings']>): Promise<Chatbot> {
    const chatbot = await this.findOne(id);
    chatbot.settings = { ...chatbot.settings, ...settings };
    return await this.chatbotRepository.save(chatbot);
  }

  async getStats(id: string): Promise<any> {
    const chatbot = await this.findOne(id);
    const conversations = chatbot.conversations;

    return {
      totalConversations: conversations.length,
      activeConversations: conversations.filter(c => 
        c.metadata.status === 'active'
      ).length,
      averageResponseTime: this.calculateAverageResponseTime(conversations),
      userSatisfaction: this.calculateUserSatisfaction(conversations),
    };
  }

  private calculateAverageResponseTime(conversations: any[]): number {
    // Implementar lógica para calcular tiempo promedio de respuesta
    return 0;
  }

  private calculateUserSatisfaction(conversations: any[]): number {
    // Implementar lógica para calcular satisfacción del usuario
    return 0;
  }
} 