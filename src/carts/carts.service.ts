import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShoppingCart } from '../chat/entities/shopping-cart.entity';
import { PersistentSession } from '../chat/entities/persistent-session.entity';
import { ValeryChatbotService } from '../valery/valery-chatbot.service';

export interface AbandonedCartData {
  sessionId: string;
  phoneNumber: string;
  clientName?: string;
  itemCount: number;
  totalUsd: number;
  totalBs: number;
  lastActivity: Date;
  daysSinceAbandoned: number;
  products: Array<{
    productCode: string;
    productName: string;
    quantity: number;
    unitPriceUsd: number;
  }>;
}

export interface CartRecoveryStats {
  totalAbandoned: number;
  recoveredToday: number;
  averageCartValue: number;
  topAbandonedProducts: Array<{
    productCode: string;
    productName: string;
    abandonedCount: number;
  }>;
}

@Injectable()
export class CartsService {
  private readonly logger = new Logger(CartsService.name);

  constructor(
    @InjectRepository(ShoppingCart, 'users')
    private cartRepository: Repository<ShoppingCart>,
    @InjectRepository(PersistentSession, 'users')
    private sessionRepository: Repository<PersistentSession>,
  ) {}

  /**
   * Detectar carritos abandonados (sin actividad por más de 24 horas)
   */
  async findAbandonedCarts(hoursThreshold: number = 24): Promise<AbandonedCartData[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hoursThreshold);

      const query = `
        SELECT 
          ps.id as session_id,
          ps."phoneNumber",
          ps."clientName",
          ps."lastActivity",
          COUNT(sc.id) as item_count,
          SUM(sc.quantity * sc."unitPriceUsd") as total_usd,
          SUM(sc.quantity * sc."unitPriceUsd" * (1 + sc."ivaTax"/100) * sc."exchangeRate") as total_bs,
          EXTRACT(DAY FROM NOW() - ps."lastActivity") as days_since_abandoned
        FROM persistent_sessions ps
        INNER JOIN shopping_carts sc ON ps.id = sc.session_id
        WHERE ps."lastActivity" < $1
          AND sc.status = 'active'
          AND ps.status = 'active'
        GROUP BY ps.id, ps."phoneNumber", ps."clientName", ps."lastActivity"
        ORDER BY ps."lastActivity" DESC
      `;

      const results = await this.cartRepository.manager.query(query, [cutoffDate]);

      const abandonedCarts: AbandonedCartData[] = [];

      for (const result of results) {
        // Obtener productos del carrito
        const products = await this.cartRepository.find({
          where: { 
            session: { id: result.session_id },
            status: 'active'
          },
          select: ['productCode', 'productName', 'quantity', 'unitPriceUsd']
        });

        abandonedCarts.push({
          sessionId: result.session_id,
          phoneNumber: result.phoneNumber,
          clientName: result.clientName,
          itemCount: parseInt(result.item_count),
          totalUsd: parseFloat(result.total_usd) || 0,
          totalBs: parseFloat(result.total_bs) || 0,
          lastActivity: new Date(result.lastActivity),
          daysSinceAbandoned: parseInt(result.days_since_abandoned),
          products: products.map(p => ({
            productCode: p.productCode,
            productName: p.productName,
            quantity: p.quantity,
            unitPriceUsd: p.unitPriceUsd
          }))
        });
      }

      this.logger.log(`🛒 Carritos abandonados detectados: ${abandonedCarts.length}`);
      return abandonedCarts;

    } catch (error) {
      this.logger.error(`Error detectando carritos abandonados: ${error.message}`);
      return [];
    }
  }

  /**
   * Obtener estadísticas de recuperación de carritos
   */
  async getCartRecoveryStats(): Promise<CartRecoveryStats> {
    try {
      // Total de carritos abandonados
      const totalAbandoned = await this.findAbandonedCarts();

      // Carritos recuperados hoy (pedidos creados desde carritos)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const recoveredQuery = `
        SELECT COUNT(*) as recovered_count
        FROM encabedoc e
        INNER JOIN persistent_sessions ps ON ps."clientId" = e.codcliente
        WHERE e.fechaemision >= $1
      `;

      const recoveredResult = await this.cartRepository.manager.query(recoveredQuery, [today]);
      const recoveredToday = parseInt(recoveredResult[0]?.recovered_count) || 0;

      // Valor promedio de carritos
      const avgValue = totalAbandoned.length > 0 
        ? totalAbandoned.reduce((sum, cart) => sum + cart.totalUsd, 0) / totalAbandoned.length 
        : 0;

      // Productos más abandonados
      const topAbandonedQuery = `
        SELECT 
          sc."productCode",
          sc."productName",
          COUNT(*) as abandoned_count
        FROM shopping_carts sc
        INNER JOIN persistent_sessions ps ON ps.id = sc.session_id
        WHERE ps."lastActivity" < NOW() - INTERVAL '24 hours'
          AND sc.status = 'active'
        GROUP BY sc."productCode", sc."productName"
        ORDER BY abandoned_count DESC
        LIMIT 10
      `;

      const topAbandoned = await this.cartRepository.manager.query(topAbandonedQuery);

      return {
        totalAbandoned: totalAbandoned.length,
        recoveredToday,
        averageCartValue: avgValue,
        topAbandonedProducts: topAbandoned.map(item => ({
          productCode: item.productCode,
          productName: item.productName,
          abandonedCount: parseInt(item.abandoned_count)
        }))
      };

    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas de carritos: ${error.message}`);
      return {
        totalAbandoned: 0,
        recoveredToday: 0,
        averageCartValue: 0,
        topAbandonedProducts: []
      };
    }
  }

  /**
   * Marcar carrito como recuperado manualmente
   */
  async markCartAsRecovered(sessionId: string): Promise<boolean> {
    try {
      // Obtener la sesión actual para preservar metadata existente
      const session = await this.sessionRepository.findOne({ where: { id: sessionId } });
      
      if (!session) {
        this.logger.error(`Sesión no encontrada: ${sessionId}`);
        return false;
      }

      // Actualizar metadata preservando datos existentes
      const updatedMetadata = {
        ...session.metadata,
        cartRecovered: true,
        recoveredAt: new Date().toISOString()
      };

      await this.sessionRepository.update(sessionId, {
        lastActivity: new Date(),
        metadata: updatedMetadata
      });

      this.logger.log(`✅ Carrito marcado como recuperado: ${sessionId}`);
      return true;

    } catch (error) {
      this.logger.error(`Error marcando carrito como recuperado: ${error.message}`);
      return false;
    }
  }

  /**
   * Limpiar carritos muy antiguos (más de 30 días)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanOldAbandonedCarts(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);

      // Usar query builder para una consulta más compleja
      const cartsToUpdate = await this.cartRepository
        .createQueryBuilder('sc')
        .innerJoin('sc.session', 'ps')
        .where('ps.lastActivity < :cutoffDate', { cutoffDate })
        .andWhere('sc.status = :status', { status: 'active' })
        .getMany();

      // Cambiar status a 'expired' para carritos muy antiguos
      for (const cart of cartsToUpdate) {
        cart.status = 'expired';
        await this.cartRepository.save(cart);
      }

      this.logger.log(`🧹 Carritos antiguos limpiados: ${cartsToUpdate.length}`);

    } catch (error) {
      this.logger.error(`Error limpiando carritos antiguos: ${error.message}`);
    }
  }

  /**
   * Generar mensaje de recuperación personalizado
   */
  generateRecoveryMessage(cart: AbandonedCartData): string {
    const timeGreeting = this.getTimeBasedGreeting();
    
    let message = `${timeGreeting} 🛒\n`;
    message += `═══════════════════════════\n`;
    message += `💭 **¡NO OLVIDE SU CARRITO!** 💭\n\n`;
    
    if (cart.clientName) {
      message += `👋 Hola **${cart.clientName}**\n`;
    } else {
      message += `👋 Estimado cliente\n`;
    }
    
    message += `🕐 Hace ${cart.daysSinceAbandoned} día(s) dejó productos en su carrito\n\n`;
    message += `🛒 **SU CARRITO GUARDADO:**\n`;
    message += `═══════════════════════════\n`;
    message += `📦 ${cart.itemCount} productos\n`;
    message += `💰 Total: $${cart.totalUsd.toFixed(2)} USD\n`;
    message += `🇻🇪 Total: Bs ${cart.totalBs.toFixed(2)}\n\n`;
    
    // Mostrar algunos productos
    const maxProducts = Math.min(3, cart.products.length);
    message += `🏷️ **PRODUCTOS DESTACADOS:**\n`;
    message += `═══════════════════════════\n`;
    
    for (let i = 0; i < maxProducts; i++) {
      const product = cart.products[i];
      message += `• ${product.productName} (${product.quantity}x)\n`;
    }
    
    if (cart.products.length > maxProducts) {
      message += `... y ${cart.products.length - maxProducts} producto(s) más\n`;
    }
    
    message += `\n🎯 **¡FINALICE SU COMPRA HOY!** 🎯\n`;
    message += `═══════════════════════════\n`;
    message += `✅ Sus productos están reservados\n`;
    message += `🚚 Entrega rápida disponible\n`;
    message += `💳 Múltiples métodos de pago\n\n`;
    message += `💬 Responda "mi carrito" para continuar 🚀`;
    
    return message;
  }

  private getTimeBasedGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 6 && hour <= 11) return '🌅 ¡Buenos días!';
    if (hour >= 12 && hour <= 18) return '☀️ ¡Buenas tardes!';
    if (hour > 18 && hour <= 23) return '🌙 ¡Buenas noches!';
    return '🌜 ¡Buena madrugada!';
  }
} 