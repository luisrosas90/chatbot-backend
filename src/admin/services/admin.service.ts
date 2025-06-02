import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersistentSession } from '../../chat/entities/persistent-session.entity';
import { ChatMessage } from '../../chat/entities/message.entity';
import { SearchHistory } from '../../chat/entities/search-history.entity';
import { ShoppingCart } from '../../chat/entities/shopping-cart.entity';
import { ExternalDbService } from '../../external-db/external-db.service';

export interface ChatbotStats {
  totalSessions: number;
  activeSessions: number;
  messagesLastWeek: number;
  averageResponseTime: number;
  conversionRate: number;
  topSearches: Array<{
    term: string;
    count: number;
  }>;
}

export interface OrderStats {
  totalOrders: number;
  ordersToday: number;
  totalRevenue: number;
  revenueToday: number;
  averageOrderValue: number;
  orderStatusBreakdown: Array<{
    status: string;
    count: number;
  }>;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(PersistentSession, 'users')
    private sessionRepository: Repository<PersistentSession>,
    @InjectRepository(ChatMessage, 'users')
    private messageRepository: Repository<ChatMessage>,
    @InjectRepository(SearchHistory, 'users')
    private searchRepository: Repository<SearchHistory>,
    @InjectRepository(ShoppingCart, 'users')
    private cartRepository: Repository<ShoppingCart>,
    private externalDbService: ExternalDbService,
  ) {}

  /**
   * Obtener estadísticas del chatbot
   */
  async getChatbotStats(): Promise<ChatbotStats> {
    try {
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Total de sesiones
      const totalSessions = await this.sessionRepository.count();

      // Sesiones activas (con actividad en las últimas 24 horas)
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const activeSessions = await this.sessionRepository.count({
        where: {
          lastActivity: oneDayAgo
        }
      });

      // Mensajes de la última semana
      const messagesLastWeek = await this.messageRepository.count({
        where: {
          createdAt: oneWeekAgo
        }
      });

      // Búsquedas más populares
      const topSearchesQuery = `
        SELECT "searchTerm" as term, COUNT(*) as count
        FROM search_histories
        WHERE "createdAt" >= $1
        GROUP BY "searchTerm"
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const topSearches = await this.searchRepository.manager.query(topSearchesQuery, [oneWeekAgo]);

      // Tasa de conversión (aproximada)
      const totalCarts = await this.cartRepository.count();
      const ordersQuery = `SELECT COUNT(*) as count FROM encabedoc WHERE fechaemision >= $1`;
      const ordersResult = await this.externalDbService.ejecutarQuery(ordersQuery, [oneWeekAgo]);
      const totalOrders = parseInt(ordersResult[0]?.count) || 0;
      
      const conversionRate = totalCarts > 0 ? (totalOrders / totalCarts) * 100 : 0;

      return {
        totalSessions,
        activeSessions,
        messagesLastWeek,
        averageResponseTime: 2.5, // Placeholder - implementar tracking real
        conversionRate: parseFloat(conversionRate.toFixed(2)),
        topSearches: topSearches.map(s => ({
          term: s.term,
          count: parseInt(s.count)
        }))
      };

    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas del chatbot: ${error.message}`);
      return {
        totalSessions: 0,
        activeSessions: 0,
        messagesLastWeek: 0,
        averageResponseTime: 0,
        conversionRate: 0,
        topSearches: []
      };
    }
  }

  /**
   * Obtener estadísticas de pedidos
   */
  async getOrderStats(): Promise<OrderStats> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Total de pedidos
      const totalOrdersQuery = `SELECT COUNT(*) as count FROM encabedoc`;
      const totalOrdersResult = await this.externalDbService.ejecutarQuery(totalOrdersQuery);
      const totalOrders = parseInt(totalOrdersResult[0]?.count) || 0;

      // Pedidos de hoy
      const todayOrdersQuery = `SELECT COUNT(*) as count FROM encabedoc WHERE fechaemision >= $1`;
      const todayOrdersResult = await this.externalDbService.ejecutarQuery(todayOrdersQuery, [today]);
      const ordersToday = parseInt(todayOrdersResult[0]?.count) || 0;

      // Ingresos totales
      const totalRevenueQuery = `SELECT SUM(total) as revenue FROM encabedoc`;
      const totalRevenueResult = await this.externalDbService.ejecutarQuery(totalRevenueQuery);
      const totalRevenue = parseFloat(totalRevenueResult[0]?.revenue) || 0;

      // Ingresos de hoy
      const todayRevenueQuery = `SELECT SUM(total) as revenue FROM encabedoc WHERE fechaemision >= $1`;
      const todayRevenueResult = await this.externalDbService.ejecutarQuery(todayRevenueQuery, [today]);
      const revenueToday = parseFloat(todayRevenueResult[0]?.revenue) || 0;

      // Valor promedio de pedido
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Desglose por estado
      const statusQuery = `
        SELECT status, COUNT(*) as count
        FROM encabedoc
        GROUP BY status
        ORDER BY count DESC
      `;
      const statusResult = await this.externalDbService.ejecutarQuery(statusQuery);
      const orderStatusBreakdown = statusResult.map(s => ({
        status: s.status,
        count: parseInt(s.count)
      }));

      return {
        totalOrders,
        ordersToday,
        totalRevenue,
        revenueToday,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        orderStatusBreakdown
      };

    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas de pedidos: ${error.message}`);
      return {
        totalOrders: 0,
        ordersToday: 0,
        totalRevenue: 0,
        revenueToday: 0,
        averageOrderValue: 0,
        orderStatusBreakdown: []
      };
    }
  }

  /**
   * Obtener números de teléfono de clientes activos
   */
  async getActiveCustomerPhones(): Promise<string[]> {
    try {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const sessions = await this.sessionRepository.find({
        where: {
          isAuthenticated: true,
          lastActivity: oneWeekAgo
        },
        select: ['phoneNumber']
      });

      return sessions.map(s => s.phoneNumber);

    } catch (error) {
      this.logger.error(`Error obteniendo teléfonos de clientes: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener sesiones con filtros
   */
  async getSessions(status?: string, limit: number = 50) {
    try {
      const whereCondition = status ? { status } : {};
      
      const sessions = await this.sessionRepository.find({
        where: whereCondition,
        order: { lastActivity: 'DESC' },
        take: limit,
        select: [
          'id', 'phoneNumber', 'clientName', 'context', 
          'status', 'lastActivity', 'messageCount', 'isAuthenticated'
        ]
      });

      return sessions;

    } catch (error) {
      this.logger.error(`Error obteniendo sesiones: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener detalles de una sesión específica
   */
  async getSessionDetails(sessionId: string) {
    try {
      const session = await this.sessionRepository.findOne({
        where: { id: sessionId },
        relations: ['messages', 'searchHistory', 'shoppingCart']
      });

      if (!session) {
        return null;
      }

      return {
        session,
        messageHistory: session.messages.slice(-20), // Últimos 20 mensajes
        recentSearches: session.searchHistory.slice(-10), // Últimas 10 búsquedas
        cartItems: session.shoppingCart.filter(item => item.status === 'active')
      };

    } catch (error) {
      this.logger.error(`Error obteniendo detalles de sesión: ${error.message}`);
      return null;
    }
  }

  /**
   * Actualizar contexto de una sesión
   */
  async updateSessionContext(sessionId: string, context: string) {
    try {
      await this.sessionRepository.update(sessionId, { context });
      return { success: true };
    } catch (error) {
      this.logger.error(`Error actualizando contexto: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener reporte de ventas
   */
  async getSalesReport(startDate: Date, endDate: Date) {
    try {
      const salesQuery = `
        SELECT 
          DATE(fechaemision) as date,
          COUNT(*) as orders,
          SUM(total) as revenue,
          AVG(total) as avg_order_value
        FROM encabedoc
        WHERE fechaemision BETWEEN $1 AND $2
        GROUP BY DATE(fechaemision)
        ORDER BY date DESC
      `;

      const salesData = await this.externalDbService.ejecutarQuery(salesQuery, [startDate, endDate]);
      
      return {
        period: { startDate, endDate },
        dailySales: salesData.map(day => ({
          date: day.date,
          orders: parseInt(day.orders),
          revenue: parseFloat(day.revenue),
          avgOrderValue: parseFloat(day.avg_order_value)
        })),
        totals: {
          orders: salesData.reduce((sum, day) => sum + parseInt(day.orders), 0),
          revenue: salesData.reduce((sum, day) => sum + parseFloat(day.revenue), 0)
        }
      };

    } catch (error) {
      this.logger.error(`Error generando reporte de ventas: ${error.message}`);
      return {
        period: { startDate, endDate },
        dailySales: [],
        totals: { orders: 0, revenue: 0 }
      };
    }
  }

  /**
   * Obtener reporte de comportamiento de clientes
   */
  async getCustomerBehaviorReport() {
    try {
      const behaviorQuery = `
        SELECT 
          ps."isAuthenticated",
          ps.context,
          COUNT(*) as count,
          AVG(ps."messageCount") as avg_messages
        FROM persistent_sessions ps
        WHERE ps."lastActivity" >= NOW() - INTERVAL '30 days'
        GROUP BY ps."isAuthenticated", ps.context
        ORDER BY count DESC
      `;

      const behaviorData = await this.sessionRepository.manager.query(behaviorQuery);

      return {
        contextDistribution: behaviorData.map(row => ({
          context: row.context,
          count: parseInt(row.count),
          avgMessages: parseFloat(row.avg_messages),
          isAuthenticated: row.isAuthenticated
        })),
        authenticationRate: this.calculateAuthenticationRate(behaviorData)
      };

    } catch (error) {
      this.logger.error(`Error generando reporte de comportamiento: ${error.message}`);
      return {
        contextDistribution: [],
        authenticationRate: 0
      };
    }
  }

  /**
   * Obtener reporte de popularidad de productos
   */
  async getProductPopularityReport(limit: number = 20) {
    try {
      const popularityQuery = `
        SELECT 
          sc."productCode",
          sc."productName",
          COUNT(*) as search_count,
          SUM(sc.quantity) as total_quantity,
          AVG(sc."unitPriceUsd") as avg_price
        FROM shopping_carts sc
        WHERE sc."createdAt" >= NOW() - INTERVAL '30 days'
        GROUP BY sc."productCode", sc."productName"
        ORDER BY search_count DESC
        LIMIT $1
      `;

      const popularityData = await this.cartRepository.manager.query(popularityQuery, [limit]);

      return popularityData.map(product => ({
        productCode: product.productCode,
        productName: product.productName,
        searchCount: parseInt(product.search_count),
        totalQuantity: parseInt(product.total_quantity),
        avgPrice: parseFloat(product.avg_price)
      }));

    } catch (error) {
      this.logger.error(`Error generando reporte de popularidad: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener configuración del chatbot
   */
  async getChatbotConfig() {
    // Implementar según necesidades específicas
    return {
      maxSessionDuration: 2 * 60 * 60 * 1000, // 2 horas
      maxCartItems: 50,
      defaultLanguage: 'es',
      autoCleanupEnabled: true,
      notificationsEnabled: true,
      debugMode: false
    };
  }

  /**
   * Actualizar configuración del chatbot
   */
  async updateChatbotConfig(config: any) {
    try {
      // Implementar guardado de configuración
      this.logger.log(`Configuración actualizada: ${JSON.stringify(config)}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error actualizando configuración: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reiniciar todas las sesiones
   */
  async resetAllSessions() {
    try {
      const result = await this.sessionRepository.update(
        {},
        { 
          context: 'initial',
          lastActivity: new Date(),
          status: 'active'
        }
      );

      this.logger.log(`Todas las sesiones reiniciadas: ${result.affected}`);
      return result;

    } catch (error) {
      this.logger.error(`Error reiniciando sesiones: ${error.message}`);
      throw error;
    }
  }

  private calculateAuthenticationRate(behaviorData: any[]): number {
    const totalSessions = behaviorData.reduce((sum, row) => sum + parseInt(row.count), 0);
    const authenticatedSessions = behaviorData
      .filter(row => row.isAuthenticated)
      .reduce((sum, row) => sum + parseInt(row.count), 0);

    return totalSessions > 0 ? (authenticatedSessions / totalSessions) * 100 : 0;
  }
} 