import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promotion } from './entities/promotion.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePromotionDto } from '../admin/dto/create-promotion.dto';
import { UpdatePromotionDto } from '../admin/dto/update-promotion.dto';

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(
    @InjectRepository(Promotion, 'users')
    private promotionRepository: Repository<Promotion>,
    private notificationsService: NotificationsService
  ) {}

  async create(createPromotionDto: CreatePromotionDto): Promise<Promotion> {
    try {
      const promotion = this.promotionRepository.create(createPromotionDto);
      return await this.promotionRepository.save(promotion);
    } catch (error) {
      this.logger.error(`Error al crear promoción: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<Promotion[]> {
    return await this.promotionRepository.find();
  }

  async findActive(): Promise<Promotion[]> {
    return await this.promotionRepository.find({
      where: { isActive: true }
    });
  }

  async findOne(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({ where: { id } });
    if (!promotion) {
      throw new NotFoundException(`Promoción con ID ${id} no encontrada`);
    }
    return promotion;
  }

  async findByCode(code: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({ where: { code } });
    if (!promotion) {
      throw new NotFoundException(`Promoción con código ${code} no encontrada`);
    }
    return promotion;
  }

  async update(id: string, updatePromotionDto: UpdatePromotionDto): Promise<Promotion> {
    try {
      const promotion = await this.findOne(id);
      Object.assign(promotion, updatePromotionDto);
      return await this.promotionRepository.save(promotion);
    } catch (error) {
      this.logger.error(`Error al actualizar promoción: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const result = await this.promotionRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Promoción con ID ${id} no encontrada`);
    }
  }

  async toggleActive(id: string): Promise<Promotion> {
    try {
      const promotion = await this.findOne(id);
      promotion.isActive = !promotion.isActive;
      return await this.promotionRepository.save(promotion);
    } catch (error) {
      this.logger.error(`Error al cambiar estado de promoción: ${error.message}`);
      throw error;
    }
  }

  async validatePromotion(
    code: string,
    userId: string,
    cartTotal: number,
    productIds: string[]
  ): Promise<{
    isValid: boolean;
    discount: number;
    message?: string;
  }> {
    try {
      const promotion = await this.findByCode(code);
      const now = new Date();

      if (now < promotion.startDate || now > promotion.endDate) {
        return {
          isValid: false,
          discount: 0,
          message: 'La promoción no está vigente'
        };
      }

      if (!promotion.isActive) {
        return {
          isValid: false,
          discount: 0,
          message: 'La promoción no está activa'
        };
      }

      if (promotion.usageLimit > 0 && promotion.usageCount >= promotion.usageLimit) {
        return {
          isValid: false,
          discount: 0,
          message: 'La promoción ha alcanzado su límite de uso'
        };
      }

      if (promotion.minimumPurchaseAmount && cartTotal < promotion.minimumPurchaseAmount) {
        return {
          isValid: false,
          discount: 0,
          message: `El monto mínimo de compra es $${promotion.minimumPurchaseAmount}`
        };
      }

      const discount = promotion.discountType === 'percentage'
        ? (cartTotal * promotion.discountAmount) / 100
        : promotion.discountAmount;

      if (promotion.maximumDiscount && discount > promotion.maximumDiscount) {
        return {
          isValid: true,
          discount: promotion.maximumDiscount
        };
      }

      return {
        isValid: true,
        discount
      };
    } catch (error) {
      this.logger.error(`Error al validar promoción: ${error.message}`);
      throw error;
    }
  }

  async applyPromotion(
    code: string,
    userId: string,
    cartTotal: number,
    productIds: string[]
  ): Promise<{
    success: boolean;
    discount: number;
    message?: string;
  }> {
    try {
      const validation = await this.validatePromotion(code, userId, cartTotal, productIds);
      
      if (!validation.isValid) {
        return {
          success: false,
          discount: 0,
          message: validation.message
        };
      }

      const promotion = await this.findByCode(code);
      promotion.usageCount += 1;
      await this.promotionRepository.save(promotion);

      return {
        success: true,
        discount: validation.discount
      };
    } catch (error) {
      this.logger.error(`Error al aplicar promoción: ${error.message}`);
      throw error;
    }
  }
} 