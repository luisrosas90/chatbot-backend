import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, LessThan, MoreThan } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { AdminMessage } from '../entities/message.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(Conversation, 'users')
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(AdminMessage, 'users')
    private messageRepository: Repository<AdminMessage>,
    @InjectRepository(User, 'users')
    private userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<Conversation[]> {
    return await this.conversationRepository.find({
      relations: ['user', 'messages', 'chatbot'],
    });
  }

  async findOne(id: string): Promise<Conversation> {
    return await this.conversationRepository.findOne({
      where: { id },
      relations: ['user', 'messages', 'chatbot'],
    });
  }

  async findByPhoneNumber(phoneNumber: string): Promise<Conversation[]> {
    return await this.conversationRepository.find({
      where: { metadata: { phoneNumber } },
      relations: ['user', 'messages', 'chatbot'],
    });
  }

  async findAbandonedCarts() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      return await this.conversationRepository.find({
        where: {
          cart: Not(null),
          updatedAt: LessThan(oneHourAgo)
        }
      });
    } catch (error) {
      this.logger.error(`Error al buscar carritos abandonados: ${error.message}`);
      throw error;
    }
  }

  async blockConversation(conversation: Conversation, reason: string) {
    try {
      conversation.metadata = {
        ...conversation.metadata,
        blockReason: reason,
        lastInteraction: new Date(),
        abandonedCart: true,
        lastMessageType: 'block',
        status: 'abandoned'
      };
      
      return await this.conversationRepository.save(conversation);
    } catch (error) {
      this.logger.error(`Error al bloquear conversación: ${error.message}`);
      throw error;
    }
  }

  async unblockConversation(conversation: Conversation) {
    try {
      conversation.metadata = {
        ...conversation.metadata,
        blockReason: null,
        lastInteraction: new Date(),
        abandonedCart: false,
        lastMessageType: 'unblock',
        status: 'active'
      };
      
      return await this.conversationRepository.save(conversation);
    } catch (error) {
      this.logger.error(`Error al desbloquear conversación: ${error.message}`);
      throw error;
    }
  }

  async addMessage(conversationId: string, messageData: Partial<AdminMessage>): Promise<AdminMessage> {
    const conversation = await this.findOne(conversationId);
    const message = this.messageRepository.create({
      ...messageData,
      conversation,
    });
    return await this.messageRepository.save(message);
  }

  async getConversationHistory(conversationId: string): Promise<AdminMessage[]> {
    const conversation = await this.findOne(conversationId);
    return conversation.messages;
  }

  async updateCart(conversationId: string, cartData: any): Promise<Conversation> {
    const conversation = await this.findOne(conversationId);
    conversation.cart = cartData;
    return await this.conversationRepository.save(conversation);
  }

  async findActiveConversations() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      return await this.conversationRepository.find({
        where: {
          updatedAt: MoreThan(oneHourAgo),
          metadata: {
            status: 'active'
          }
        }
      });
    } catch (error) {
      this.logger.error(`Error al buscar conversaciones activas: ${error.message}`);
      throw error;
    }
  }

  async getConversationStats(conversationId: string): Promise<any> {
    const conversation = await this.findOne(conversationId);
    const messages = conversation.messages;

    return {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.direction === 'incoming').length,
      botMessages: messages.filter(m => m.direction === 'outgoing').length,
      averageResponseTime: this.calculateAverageResponseTime(messages),
      lastInteraction: conversation.updatedAt,
      cartStatus: conversation.cart ? 'active' : 'empty',
    };
  }

  private calculateAverageResponseTime(messages: AdminMessage[]): number {
    // Implementar lógica para calcular tiempo promedio de respuesta
    return 0;
  }
} 