import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Discount, DiscountType, DiscountStatus } from './entities/discount.entity';

export interface CreateDiscountDto {
  name: string;
  description?: string;
  type: DiscountType;
  value: number;
  minimumAmount?: number;
  maximumDiscount?: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  promoCodes?: string[];
  usageLimit?: number;
  totalUsageLimit?: number;
  startDate: Date;
  endDate: Date;
  isDailyOffer?: boolean;
  priority?: number;
  metadata?: any;
  createdBy?: string;
}

export interface DiscountValidation {
  isValid: boolean;
  discount: Discount | null;
  discountAmount: number;
  message?: string;
}

export interface DailyOfferStats {
  totalOffers: number;
  activeOffers: number;
  todayUsage: number;
  totalSavings: number;
  topProducts: Array<{
    productCode: string;
    usageCount: number;
    totalSavings: number;
  }>;
}

@Injectable()
export class DiscountsService {
  private readonly logger = new Logger(DiscountsService.name);

  constructor(
    @InjectRepository(Discount, 'users')
    private discountRepository: Repository<Discount>,
  ) {}

  /**
   * Crear nuevo descuento
   */
  async createDiscount(createDiscountDto: CreateDiscountDto): Promise<Discount> {
    try {
      const discount = this.discountRepository.create({
        ...createDiscountDto,
        applicableProducts: createDiscountDto.applicableProducts?.join(','),
        applicableCategories: createDiscountDto.applicableCategories?.join(','),
        promoCodes: createDiscountDto.promoCodes?.join(','),
        status: DiscountStatus.ACTIVE
      });

      const savedDiscount = await this.discountRepository.save(discount);
      this.logger.log(`✅ Descuento creado: ${savedDiscount.name} (${savedDiscount.id})`);
      
      return savedDiscount;
    } catch (error) {
      this.logger.error(`Error creando descuento: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener todos los descuentos activos
   */
  async getActiveDiscounts(): Promise<Discount[]> {
    const now = new Date();
    
    return await this.discountRepository.find({
      where: {
        status: DiscountStatus.ACTIVE,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now)
      },
      order: { priority: 'DESC', createdAt: 'DESC' }
    });
  }

  /**
   * Obtener ofertas del día activas
   */
  async getDailyOffers(): Promise<Discount[]> {
    const now = new Date();
    
    return await this.discountRepository.find({
      where: {
        status: DiscountStatus.ACTIVE,
        isDailyOffer: true,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now)
      },
      order: { priority: 'DESC', value: 'DESC' }
    });
  }

  /**
   * Validar descuento aplicable para un carrito
   */
  async validateCartDiscount(
    cartTotal: number,
    productCodes: string[],
    phoneNumber?: string,
    promoCode?: string
  ): Promise<DiscountValidation> {
    try {
      const activeDiscounts = await this.getActiveDiscounts();
      
      // Si hay código promocional, buscar específicamente
      if (promoCode) {
        const promoDiscount = activeDiscounts.find(d => 
          d.promoCodes && d.promoCodes.split(',').map(c => c.trim()).includes(promoCode)
        );
        
        if (promoDiscount) {
          return await this.validateSpecificDiscount(promoDiscount, cartTotal, productCodes, phoneNumber);
        } else {
          return {
            isValid: false,
            discount: null,
            discountAmount: 0,
            message: 'Código promocional inválido'
          };
        }
      }

      // Buscar el mejor descuento automático aplicable
      let bestDiscount: Discount | null = null;
      let bestDiscountAmount = 0;

      for (const discount of activeDiscounts) {
        const validation = await this.validateSpecificDiscount(discount, cartTotal, productCodes, phoneNumber);
        
        if (validation.isValid && validation.discountAmount > bestDiscountAmount) {
          bestDiscount = discount;
          bestDiscountAmount = validation.discountAmount;
        }
      }

      if (bestDiscount) {
        return {
          isValid: true,
          discount: bestDiscount,
          discountAmount: bestDiscountAmount
        };
      }

      return {
        isValid: false,
        discount: null,
        discountAmount: 0,
        message: 'No hay descuentos aplicables'
      };

    } catch (error) {
      this.logger.error(`Error validando descuento: ${error.message}`);
      return {
        isValid: false,
        discount: null,
        discountAmount: 0,
        message: 'Error validando descuento'
      };
    }
  }

  /**
   * Validar un descuento específico
   */
  private async validateSpecificDiscount(
    discount: Discount,
    cartTotal: number,
    productCodes: string[],
    phoneNumber?: string
  ): Promise<DiscountValidation> {
    // Verificar monto mínimo
    if (cartTotal < discount.minimumAmount) {
      return {
        isValid: false,
        discount: null,
        discountAmount: 0,
        message: `Monto mínimo requerido: $${discount.minimumAmount}`
      };
    }

    // Verificar límite de uso total
    if (discount.totalUsageLimit && discount.currentUsage >= discount.totalUsageLimit) {
      return {
        isValid: false,
        discount: null,
        discountAmount: 0,
        message: 'Descuento agotado'
      };
    }

    // Verificar productos aplicables
    if (discount.applicableProducts) {
      const applicableProducts = discount.applicableProducts.split(',').map(p => p.trim());
      const hasApplicableProduct = productCodes.some(code => applicableProducts.includes(code));
      
      if (!hasApplicableProduct) {
        return {
          isValid: false,
          discount: null,
          discountAmount: 0,
          message: 'Productos no elegibles para este descuento'
        };
      }
    }

    // Calcular descuento
    let discountAmount = 0;
    
    switch (discount.type) {
      case DiscountType.PERCENTAGE:
        discountAmount = (cartTotal * discount.value) / 100;
        break;
      case DiscountType.FIXED_AMOUNT:
        discountAmount = discount.value;
        break;
      case DiscountType.FREE_SHIPPING:
        discountAmount = 0; // Se maneja en el frontend
        break;
      case DiscountType.BUY_X_GET_Y:
        // Lógica específica para compra X obtén Y
        discountAmount = this.calculateBuyXGetYDiscount(discount, productCodes, cartTotal);
        break;
    }

    // Aplicar límite máximo de descuento
    if (discount.maximumDiscount && discountAmount > discount.maximumDiscount) {
      discountAmount = discount.maximumDiscount;
    }

    // No permitir descuento mayor al total del carrito
    if (discountAmount > cartTotal) {
      discountAmount = cartTotal;
    }

    return {
      isValid: true,
      discount,
      discountAmount
    };
  }

  /**
   * Aplicar descuento y actualizar contadores
   */
  async applyDiscount(discountId: string, phoneNumber?: string): Promise<boolean> {
    try {
      const discount = await this.discountRepository.findOne({ where: { id: discountId } });
      
      if (!discount) {
        return false;
      }

      // Incrementar contador de uso
      discount.currentUsage += 1;
      await this.discountRepository.save(discount);

      this.logger.log(`✅ Descuento aplicado: ${discount.name} (Uso #${discount.currentUsage})`);
      return true;

    } catch (error) {
      this.logger.error(`Error aplicando descuento: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtener estadísticas de ofertas del día
   */
  async getDailyOfferStats(): Promise<DailyOfferStats> {
    try {
      const dailyOffers = await this.getDailyOffers();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Calcular estadísticas
      const totalOffers = dailyOffers.length;
      const activeOffers = dailyOffers.filter(d => d.status === DiscountStatus.ACTIVE).length;
      
      // Uso de hoy (simplificado - en producción usar tabla de log de descuentos)
      const todayUsage = dailyOffers.reduce((sum, d) => sum + d.currentUsage, 0);
      
      // Ahorro total estimado
      const totalSavings = dailyOffers.reduce((sum, d) => {
        const avgSaving = d.type === DiscountType.PERCENTAGE ? d.value * 10 : d.value; // Estimación
        return sum + (avgSaving * d.currentUsage);
      }, 0);

      return {
        totalOffers,
        activeOffers,
        todayUsage,
        totalSavings,
        topProducts: [] // Implementar cuando tengamos tabla de log de descuentos
      };

    } catch (error) {
      this.logger.error(`Error obteniendo estadísticas: ${error.message}`);
      return {
        totalOffers: 0,
        activeOffers: 0,
        todayUsage: 0,
        totalSavings: 0,
        topProducts: []
      };
    }
  }

  /**
   * Programar ofertas del día automáticamente
   */
  async scheduleDailyOffers(): Promise<void> {
    try {
      // Ejemplo: crear ofertas automáticas basadas en inventario o ventas
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Crear oferta del día automática (ejemplo)
      const autoOffer: CreateDiscountDto = {
        name: `Oferta del Día - ${tomorrow.toLocaleDateString()}`,
        description: 'Descuento automático del día',
        type: DiscountType.PERCENTAGE,
        value: 10, // 10% de descuento
        minimumAmount: 20, // Mínimo $20
        maximumDiscount: 50, // Máximo $50 de descuento
        startDate: tomorrow,
        endDate: dayAfterTomorrow,
        isDailyOffer: true,
        priority: 5,
        totalUsageLimit: 100, // Máximo 100 usos
        createdBy: 'SYSTEM_AUTO'
      };

      await this.createDiscount(autoOffer);
      this.logger.log(`✅ Oferta del día programada para ${tomorrow.toLocaleDateString()}`);

    } catch (error) {
      this.logger.error(`Error programando ofertas del día: ${error.message}`);
    }
  }

  /**
   * Actualizar estados de descuentos automáticamente
   */
  @Cron(CronExpression.EVERY_HOUR)
  async updateDiscountStatuses(): Promise<void> {
    try {
      const now = new Date();

      // Expirar descuentos vencidos
      await this.discountRepository.update(
        {
          status: DiscountStatus.ACTIVE,
          endDate: LessThanOrEqual(now)
        },
        { status: DiscountStatus.EXPIRED }
      );

      // Activar descuentos programados
      await this.discountRepository.update(
        {
          status: DiscountStatus.SCHEDULED,
          startDate: LessThanOrEqual(now),
          endDate: MoreThanOrEqual(now)
        },
        { status: DiscountStatus.ACTIVE }
      );

      this.logger.log('✅ Estados de descuentos actualizados');

    } catch (error) {
      this.logger.error(`Error actualizando estados: ${error.message}`);
    }
  }

  /**
   * Limpiar descuentos muy antiguos
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanOldDiscounts(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90); // 3 meses

      const result = await this.discountRepository.delete({
        status: DiscountStatus.EXPIRED,
        endDate: LessThanOrEqual(cutoffDate)
      });

      this.logger.log(`🧹 Descuentos antiguos eliminados: ${result.affected}`);

    } catch (error) {
      this.logger.error(`Error limpiando descuentos: ${error.message}`);
    }
  }

  /**
   * Calcular descuento tipo "Compra X obtén Y"
   */
  private calculateBuyXGetYDiscount(discount: Discount, productCodes: string[], cartTotal: number): number {
    // Lógica específica para compra X obtén Y
    // Por simplicidad, aplicar descuento fijo cuando se cumple la condición
    const metadata = discount.metadata;
    if (metadata?.buyQuantity && metadata?.getQuantity) {
      const buyQty = metadata.buyQuantity;
      const applicableItems = productCodes.length;
      
      if (applicableItems >= buyQty) {
        return discount.value; // Descuento fijo cuando se cumple la condición
      }
    }
    
    return 0;
  }

  /**
   * Generar mensaje promocional para ofertas
   */
  generateOfferMessage(offers: Discount[]): string {
    if (offers.length === 0) {
      return '';
    }

    let message = `🔥 **¡OFERTAS ESPECIALES DE HOY!** 🔥\n`;
    message += `═══════════════════════════\n`;
    message += `⏰ ¡Válidas solo por tiempo limitado!\n\n`;

    offers.slice(0, 3).forEach((offer, index) => {
      message += `${index + 1}️⃣ **${offer.name}**\n`;
      
      if (offer.type === DiscountType.PERCENTAGE) {
        message += `💰 ${offer.value}% de descuento\n`;
      } else if (offer.type === DiscountType.FIXED_AMOUNT) {
        message += `💰 $${offer.value} de descuento\n`;
      }
      
      if (offer.minimumAmount > 0) {
        message += `📋 Compra mínima: $${offer.minimumAmount}\n`;
      }
      
      if (offer.totalUsageLimit) {
        const remaining = offer.totalUsageLimit - offer.currentUsage;
        message += `⚡ Quedan ${remaining} ofertas\n`;
      }
      
      message += `\n`;
    });

    if (offers.length > 3) {
      message += `... y ${offers.length - 3} ofertas más disponibles!\n\n`;
    }

    message += `🛒 **¡APROVECHA YA!** 🛒\n`;
    message += `═══════════════════════════\n`;
    message += `💬 Escribe lo que necesitas\n`;
    message += `🚀 ¡Los descuentos se aplican automáticamente!`;

    return message;
  }
} 