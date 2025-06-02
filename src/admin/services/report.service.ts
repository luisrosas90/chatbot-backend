import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { AdminMessage } from '../entities/message.entity';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';
import { Promotion } from '../../promotions/entities/promotion.entity';

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name);

  constructor(
    @InjectRepository(AdminMessage, 'users')
    private readonly messageRepository: Repository<AdminMessage>,
    @InjectRepository(Conversation, 'users')
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(User, 'users')
    private readonly userRepository: Repository<User>,
    @InjectRepository(Promotion, 'users')
    private promotionRepository: Repository<Promotion>,
    @InjectRepository(Order, 'users')
    private orderRepository: Repository<Order>,
  ) {}

  async getSalesReport(startDate: Date, endDate: Date) {
    try {
      const conversations = await this.conversationRepository.find({
        where: {
          updatedAt: Between(startDate, endDate)
        }
      });

      const totalSales = conversations.reduce((sum, conv) => {
        return sum + (conv.cart?.total || 0);
      }, 0);

      const activeConversations = conversations.filter(c => 
        c.metadata.status === 'active'
      ).length;

      return {
        totalSales,
        totalOrders: conversations.length,
        averageOrderValue: totalSales / conversations.length || 0,
        activeConversations,
        salesByDay: this.groupSalesByDay(conversations),
        salesByPaymentMethod: this.groupSalesByPaymentMethod(conversations)
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de ventas: ${error.message}`);
      throw error;
    }
  }

  async getConversationReport(startDate: Date, endDate: Date) {
    try {
      const conversations = await this.conversationRepository.find({
        where: {
          updatedAt: Between(startDate, endDate)
        },
        relations: ['messages', 'user'],
      });

      return {
        totalConversations: conversations.length,
        activeConversations: conversations.filter(c => 
          c.metadata.status === 'active'
        ).length,
        totalMessages: conversations.reduce((acc, c) => acc + c.messages.length, 0),
        averageResponseTime: this.calculateAverageResponseTime(conversations),
        conversationFlow: this.analyzeConversationFlow(conversations),
        userEngagement: this.calculateUserEngagement(conversations),
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de conversaciones: ${error.message}`);
      throw error;
    }
  }

  async getPromotionReport(startDate: Date, endDate: Date) {
    try {
      const promotions = await this.promotionRepository.find({
        where: {
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate)
        }
      });

      return {
        activePromotions: promotions.filter(p => p.isActive).length,
        totalPromotions: promotions.length,
        promotionUsage: this.calculatePromotionUsage(promotions),
        revenueImpact: this.calculatePromotionRevenueImpact(promotions),
        topPromotions: this.getTopPromotions(promotions),
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de promociones: ${error.message}`);
      throw error;
    }
  }

  async getUserReport() {
    try {
      const users = await this.userRepository.find({
        relations: ['conversations'],
      });

      return {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === 'active').length,
        blockedUsers: users.filter(u => u.status === 'blocked').length,
        userSegments: this.segmentUsers(users),
        userActivity: this.analyzeUserActivity(users),
        retentionMetrics: this.calculateRetentionMetrics(users),
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de usuarios: ${error.message}`);
      throw error;
    }
  }

  private groupSalesByDay(conversations: Conversation[]) {
    const salesByDay = new Map<string, number>();
    
    conversations.forEach(conv => {
      const date = conv.updatedAt.toISOString().split('T')[0];
      const total = conv.cart?.total || 0;
      salesByDay.set(date, (salesByDay.get(date) || 0) + total);
    });

    return Array.from(salesByDay.entries()).map(([date, total]) => ({
      date,
      total,
      count: conversations.filter(c => 
        c.updatedAt.toISOString().split('T')[0] === date
      ).length
    }));
  }

  private groupSalesByPaymentMethod(conversations: Conversation[]) {
    const salesByMethod = new Map<string, number>();
    
    conversations.forEach(conv => {
      const method = conv.cart?.paymentMethod || 'unknown';
      const total = conv.cart?.total || 0;
      salesByMethod.set(method, (salesByMethod.get(method) || 0) + total);
    });

    return Array.from(salesByMethod.entries()).map(([method, total]) => ({
      method,
      total,
      count: conversations.filter(c => 
        (c.cart?.paymentMethod || 'unknown') === method
      ).length
    }));
  }

  private calculateAverageResponseTime(conversations: any[]): number {
    // Implementar lógica para calcular tiempo promedio de respuesta
    return 0;
  }

  private analyzeConversationFlow(conversations: any[]): any {
    // Implementar lógica para analizar flujo de conversaciones
    return {};
  }

  private calculateUserEngagement(conversations: any[]): any {
    // Implementar lógica para calcular engagement de usuarios
    return {};
  }

  private calculatePromotionUsage(promotions: any[]): any {
    // Implementar lógica para calcular uso de promociones
    return {};
  }

  private calculatePromotionRevenueImpact(promotions: any[]): any {
    // Implementar lógica para calcular impacto en ingresos
    return {};
  }

  private getTopPromotions(promotions: any[]): any[] {
    // Implementar lógica para obtener promociones más usadas
    return [];
  }

  private segmentUsers(users: any[]): any {
    // Implementar lógica para segmentar usuarios
    return {};
  }

  private analyzeUserActivity(users: any[]): any {
    // Implementar lógica para analizar actividad de usuarios
    return {};
  }

  private calculateRetentionMetrics(users: any[]): any {
    // Implementar lógica para calcular métricas de retención
    return {};
  }
} 