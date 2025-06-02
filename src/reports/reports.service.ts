import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { Promotion } from '../promotions/entities/promotion.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(Order, 'users')
    private orderRepository: Repository<Order>,
    @InjectRepository(Promotion, 'users')
    private promotionRepository: Repository<Promotion>,
    @InjectRepository(User, 'users')
    private userRepository: Repository<User>
  ) {}

  async getSalesReport(startDate: Date, endDate: Date): Promise<{
    totalSales: number;
    totalOrders: number;
    averageOrderValue: number;
    salesByDay: Array<{ date: string; total: number; count: number }>;
    salesByPaymentMethod: Array<{ method: string; total: number; count: number }>;
  }> {
    try {
      const orders = await this.orderRepository.find({
        where: {
          updatedAt: Between(startDate, endDate)
        }
      });

      const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
      const totalOrders = orders.length;
      const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

      const salesByDay = this.groupByDay(orders);
      const salesByPaymentMethod = this.groupByPaymentMethod(orders);

      return {
        totalSales,
        totalOrders,
        averageOrderValue,
        salesByDay,
        salesByPaymentMethod
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de ventas: ${error.message}`);
      throw error;
    }
  }

  async getPromotionsReport(startDate: Date, endDate: Date): Promise<{
    totalPromotions: number;
    activePromotions: number;
    totalDiscounts: number;
    promotionsByType: Array<{ type: string; count: number; totalDiscount: number }>;
    mostUsedPromotions: Array<{ code: string; usageCount: number; totalDiscount: number }>;
  }> {
    try {
      const promotions = await this.promotionRepository.find({
        where: {
          startDate: LessThanOrEqual(endDate),
          endDate: MoreThanOrEqual(startDate)
        }
      });

      const totalPromotions = promotions.length;
      const activePromotions = promotions.filter(p => p.isActive).length;
      const totalDiscounts = promotions.reduce((sum, p) => sum + p.discountAmount, 0);

      const promotionsByType = this.groupByType(promotions);
      const mostUsedPromotions = this.getMostUsedPromotions(promotions);

      return {
        totalPromotions,
        activePromotions,
        totalDiscounts,
        promotionsByType,
        mostUsedPromotions
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de promociones: ${error.message}`);
      throw error;
    }
  }

  async getUsersReport(startDate: Date, endDate: Date): Promise<{
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    usersByType: Array<{ type: string; count: number }>;
    usersByStatus: Array<{ status: string; count: number }>;
  }> {
    try {
      const users = await this.userRepository.find({
        where: {
          updatedAt: Between(startDate, endDate)
        }
      });

      const totalUsers = users.length;
      const newUsers = users.filter(u => u.updatedAt >= startDate).length;
      const activeUsers = users.filter(u => u.status === 'active').length;

      const usersByType = this.groupUsersByType(users);
      const usersByStatus = this.groupUsersByStatus(users);

      return {
        totalUsers,
        newUsers,
        activeUsers,
        usersByType,
        usersByStatus
      };
    } catch (error) {
      this.logger.error(`Error al generar reporte de usuarios: ${error.message}`);
      throw error;
    }
  }

  private groupByDay(orders: Order[]): Array<{ date: string; total: number; count: number }> {
    const salesByDay = new Map<string, { total: number; count: number }>();
    orders.forEach(order => {
      const day = order.updatedAt.toISOString().split('T')[0];
      const current = salesByDay.get(day) || { total: 0, count: 0 };
      salesByDay.set(day, {
        total: current.total + order.total,
        count: current.count + 1
      });
    });
    return Array.from(salesByDay.entries()).map(([date, data]) => ({ date, ...data }));
  }

  private groupByPaymentMethod(orders: Order[]): Array<{ method: string; total: number; count: number }> {
    const salesByPaymentMethod = new Map<string, { total: number; count: number }>();
    orders.forEach(order => {
      const current = salesByPaymentMethod.get(order.paymentMethod) || { total: 0, count: 0 };
      salesByPaymentMethod.set(order.paymentMethod, {
        total: current.total + order.total,
        count: current.count + 1
      });
    });
    return Array.from(salesByPaymentMethod.entries()).map(([method, data]) => ({ method, ...data }));
  }

  private groupByType(promotions: Promotion[]): Array<{ type: string; count: number; totalDiscount: number }> {
    const promotionsByType = new Map<string, { count: number; totalDiscount: number }>();
    promotions.forEach(promotion => {
      const current = promotionsByType.get(promotion.discountType) || { count: 0, totalDiscount: 0 };
      promotionsByType.set(promotion.discountType, {
        count: current.count + 1,
        totalDiscount: current.totalDiscount + promotion.discountAmount
      });
    });
    return Array.from(promotionsByType.entries()).map(([type, data]) => ({ type, ...data }));
  }

  private getMostUsedPromotions(promotions: Promotion[]): Array<{ code: string; usageCount: number; totalDiscount: number }> {
    return promotions
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5)
      .map(promotion => ({
        code: promotion.code,
        usageCount: promotion.usageCount,
        totalDiscount: promotion.discountAmount * promotion.usageCount
      }));
  }

  private groupUsersByType(users: User[]): Array<{ type: string; count: number }> {
    const usersByType = new Map<string, number>();
    users.forEach(user => {
      const current = usersByType.get(user.role) || 0;
      usersByType.set(user.role, current + 1);
    });
    return Array.from(usersByType.entries()).map(([type, count]) => ({ type, count }));
  }

  private groupUsersByStatus(users: User[]): Array<{ status: string; count: number }> {
    const usersByStatus = new Map<string, number>();
    users.forEach(user => {
      const status = user.status;
      const current = usersByStatus.get(status) || 0;
      usersByStatus.set(status, current + 1);
    });
    return Array.from(usersByStatus.entries()).map(([status, count]) => ({ status, count }));
  }
} 