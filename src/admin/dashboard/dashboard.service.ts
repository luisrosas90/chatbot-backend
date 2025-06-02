import { Injectable, Logger } from '@nestjs/common';
import { ReportsService } from '../../reports/reports.service';
import { PromotionsService } from '../../promotions/promotions.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { ConversationService } from '../services/conversation.service';
import { PromotionService } from '../services/promotion.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);
  private readonly defaultInstanceId: string;

  constructor(
    private reportsService: ReportsService,
    private promotionsService: PromotionsService,
    private notificationsService: NotificationsService,
    private whatsappService: WhatsappService,
    private readonly conversationService: ConversationService,
    private readonly promotionService: PromotionService,
    private readonly configService: ConfigService
  ) {
    this.defaultInstanceId = this.configService.get<string>('WHATSAPP_DEFAULT_INSTANCE');
  }

  async getDashboardSummary() {
    try {
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // Obtener reportes
      const salesReport = await this.reportsService.getSalesReport(startOfMonth, endOfMonth);
      const promotionsReport = await this.reportsService.getPromotionsReport(startOfMonth, endOfMonth);
      const usersReport = await this.reportsService.getUsersReport(startOfMonth, endOfMonth);

      // Obtener estado de WhatsApp
      const whatsappStatus = await this.whatsappService.getConnectionStatus(this.defaultInstanceId);

      // Obtener promociones activas
      const activePromotions = await this.promotionsService.findActive();

      return {
        sales: {
          total: salesReport.totalSales,
          orders: salesReport.totalOrders,
          average: salesReport.averageOrderValue,
          byDay: salesReport.salesByDay,
          byPaymentMethod: salesReport.salesByPaymentMethod
        },
        promotions: {
          total: promotionsReport.totalPromotions,
          active: promotionsReport.activePromotions,
          totalDiscounts: promotionsReport.totalDiscounts,
          byType: promotionsReport.promotionsByType,
          mostUsed: promotionsReport.mostUsedPromotions
        },
        users: {
          total: usersReport.totalUsers,
          new: usersReport.newUsers,
          active: usersReport.activeUsers,
          byType: usersReport.usersByType,
          byStatus: usersReport.usersByStatus
        },
        whatsapp: {
          status: whatsappStatus.status,
          phoneNumber: whatsappStatus.phoneNumber,
          name: whatsappStatus.name
        },
        activePromotions: activePromotions.map(p => ({
          id: p.id,
          name: p.name,
          code: p.code,
          discountAmount: p.discountAmount,
          discountType: p.discountType,
          usageCount: p.usageCount,
          usageLimit: p.usageLimit
        }))
      };
    } catch (error) {
      this.logger.error(`Error al obtener resumen del dashboard: ${error.message}`);
      throw error;
    }
  }

  async getSystemHealth() {
    try {
      const whatsappStatus = await this.whatsappService.getConnectionStatus(this.defaultInstanceId);
      const activePromotions = await this.promotionsService.findActive();

      return {
        status: 'healthy',
        components: {
          whatsapp: {
            status: whatsappStatus.status,
            lastCheck: new Date()
          },
          database: {
            status: 'connected',
            lastCheck: new Date()
          },
          notifications: {
            status: 'active',
            lastCheck: new Date()
          }
        },
        metrics: {
          activePromotions: activePromotions.length,
          whatsappConnected: whatsappStatus.status === 'connected'
        }
      };
    } catch (error) {
      this.logger.error(`Error al obtener estado del sistema: ${error.message}`);
      throw error;
    }
  }

  async getRecentActivity() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      const salesReport = await this.reportsService.getSalesReport(startOfDay, endOfDay);
      const usersReport = await this.reportsService.getUsersReport(startOfDay, endOfDay);

      return {
        sales: {
          today: salesReport.totalSales,
          orders: salesReport.totalOrders
        },
        users: {
          new: usersReport.newUsers,
          active: usersReport.activeUsers
        },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error(`Error al obtener actividad reciente: ${error.message}`);
      throw error;
    }
  }

  async getDashboardStats() {
    try {
      const [
        activeConversations,
        abandonedCarts,
        activePromotions,
        whatsappStatus
      ] = await Promise.all([
        this.conversationService.findActiveConversations(),
        this.conversationService.findAbandonedCarts(),
        this.promotionService.findActive(),
        this.whatsappService.getConnectionStatus(this.defaultInstanceId)
      ]);

      return {
        activeConversations: activeConversations.length,
        abandonedCarts: abandonedCarts.length,
        activePromotions: activePromotions.length,
        whatsappStatus
      };
    } catch (error) {
      this.logger.error(`Error al obtener estadísticas del dashboard: ${error.message}`);
      throw error;
    }
  }

  async getDetailedStats() {
    try {
      const [
        activeConversations,
        abandonedCarts,
        activePromotions,
        whatsappStatus
      ] = await Promise.all([
        this.conversationService.findActiveConversations(),
        this.conversationService.findAbandonedCarts(),
        this.promotionService.findActive(),
        this.whatsappService.getConnectionStatus(this.defaultInstanceId)
      ]);

      return {
        conversations: {
          active: activeConversations,
          abandoned: abandonedCarts
        },
        promotions: activePromotions,
        whatsappStatus
      };
    } catch (error) {
      this.logger.error(`Error al obtener estadísticas detalladas: ${error.message}`);
      throw error;
    }
  }
} 