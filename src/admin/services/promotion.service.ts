import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Promotion } from '../../promotions/entities/promotion.entity';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

@Injectable()
export class PromotionService {
  private readonly logger = new Logger(PromotionService.name);

  constructor(
    @InjectRepository(Promotion, 'users')
    private promotionRepository: Repository<Promotion>
  ) {}

  async create(createPromotionDto: CreatePromotionDto): Promise<Promotion> {
    try {
      const promotion = this.promotionRepository.create({
        ...createPromotionDto,
        usageCount: 0
      });
      return await this.promotionRepository.save(promotion);
    } catch (error) {
      this.logger.error(`Error al crear promoción: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<Promotion[]> {
    return await this.promotionRepository.find();
  }

  async findOne(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({ where: { id } });
    if (!promotion) {
      throw new NotFoundException(`Promoción con ID ${id} no encontrada`);
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

  async findActive(): Promise<Promotion[]> {
    const now = new Date();
    return await this.promotionRepository.find({
      where: {
        isActive: true,
        startDate: LessThanOrEqual(now),
        endDate: MoreThanOrEqual(now)
      }
    });
  }

  async calculateDiscount(promotionId: string, amount: number): Promise<{ discount: number; message?: string }> {
    const promotion = await this.findOne(promotionId);

    if (!promotion.isActive) {
      return { discount: 0, message: 'La promoción no está activa' };
    }

    const now = new Date();
    if (now < promotion.startDate || now > promotion.endDate) {
      return { discount: 0, message: 'La promoción ha expirado' };
    }

    if (promotion.minimumPurchaseAmount && amount < promotion.minimumPurchaseAmount) {
      return { 
        discount: 0, 
        message: `Monto mínimo de compra: ${promotion.minimumPurchaseAmount}` 
      };
    }

    let discount = 0;
    if (promotion.discountType === 'percentage') {
      discount = amount * (promotion.discountAmount / 100);
    } else if (promotion.discountType === 'fixed') {
      discount = promotion.discountAmount;
    }

    if (promotion.maximumDiscount && discount > promotion.maximumDiscount) {
      discount = promotion.maximumDiscount;
    }

    return { discount };
  }

  async applyPromotion(promotionId: string, amount: number): Promise<{ finalAmount: number; discount: number }> {
    const { discount, message } = await this.calculateDiscount(promotionId, amount);
    
    if (message) {
      throw new Error(message);
    }

    const promotion = await this.findOne(promotionId);
    promotion.usageCount++;
    await this.promotionRepository.save(promotion);

    return {
      finalAmount: amount - discount,
      discount
    };
  }
} 