import { Controller, Get, Post, Body, Param, Put, Delete, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { Promotion } from './entities/promotion.entity';
import { CreatePromotionDto } from '../admin/dto/create-promotion.dto';
import { UpdatePromotionDto } from '../admin/dto/update-promotion.dto';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  private readonly logger = new Logger(PromotionsController.name);

  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva promoción' })
  @ApiResponse({ status: 201, description: 'Promoción creada exitosamente' })
  async create(@Body() createPromotionDto: CreatePromotionDto): Promise<Promotion> {
    this.logger.log('Creando nueva promoción');
    try {
      return await this.promotionsService.create(createPromotionDto);
    } catch (error) {
      this.logger.error(`Error al crear promoción: ${error.message}`);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todas las promociones' })
  @ApiResponse({ status: 200, description: 'Lista de promociones obtenida exitosamente' })
  async findAll(): Promise<Promotion[]> {
    this.logger.log('Obteniendo todas las promociones');
    try {
      return await this.promotionsService.findAll();
    } catch (error) {
      this.logger.error(`Error al obtener promociones: ${error.message}`);
      throw error;
    }
  }

  @Get('active')
  @ApiOperation({ summary: 'Obtener promociones activas' })
  @ApiResponse({ status: 200, description: 'Lista de promociones activas' })
  async findActive(): Promise<Promotion[]> {
    this.logger.log('Obteniendo promociones activas');
    try {
      return await this.promotionsService.findActive();
    } catch (error) {
      this.logger.error(`Error al obtener promociones activas: ${error.message}`);
      throw error;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una promoción por ID' })
  @ApiResponse({ status: 200, description: 'Promoción encontrada exitosamente' })
  async findOne(@Param('id') id: string): Promise<Promotion> {
    this.logger.log(`Obteniendo promoción con ID ${id}`);
    try {
      return await this.promotionsService.findOne(id);
    } catch (error) {
      this.logger.error(`Error al obtener promoción: ${error.message}`);
      throw error;
    }
  }

  @Get('code/:code')
  async findByCode(@Param('code') code: string): Promise<Promotion> {
    this.logger.log(`Buscando promoción con código ${code}`);
    try {
      return await this.promotionsService.findByCode(code);
    } catch (error) {
      this.logger.error(`Error al buscar promoción por código: ${error.message}`);
      throw error;
    }
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una promoción' })
  @ApiResponse({ status: 200, description: 'Promoción actualizada exitosamente' })
  async update(
    @Param('id') id: string,
    @Body() updatePromotionDto: UpdatePromotionDto
  ): Promise<Promotion> {
    this.logger.log(`Actualizando promoción con ID ${id}`);
    try {
      return await this.promotionsService.update(id, updatePromotionDto);
    } catch (error) {
      this.logger.error(`Error al actualizar promoción: ${error.message}`);
      throw error;
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una promoción' })
  @ApiResponse({ status: 200, description: 'Promoción eliminada exitosamente' })
  async remove(@Param('id') id: string): Promise<void> {
    this.logger.log(`Eliminando promoción con ID ${id}`);
    try {
      await this.promotionsService.remove(id);
    } catch (error) {
      this.logger.error(`Error al eliminar promoción: ${error.message}`);
      throw error;
    }
  }

  @Put(':id/toggle')
  async toggleActive(@Param('id') id: string): Promise<Promotion> {
    this.logger.log(`Cambiando estado de promoción con ID ${id}`);
    try {
      return await this.promotionsService.toggleActive(id);
    } catch (error) {
      this.logger.error(`Error al cambiar estado de promoción: ${error.message}`);
      throw error;
    }
  }

  @Post('validate')
  async validatePromotion(@Body() data: {
    code: string;
    userId: string;
    cartTotal: number;
    productIds: string[];
  }): Promise<{
    isValid: boolean;
    discount: number;
    message?: string;
  }> {
    this.logger.log(`Validando promoción con código ${data.code}`);
    try {
      return await this.promotionsService.validatePromotion(
        data.code,
        data.userId,
        data.cartTotal,
        data.productIds
      );
    } catch (error) {
      this.logger.error(`Error al validar promoción: ${error.message}`);
      throw error;
    }
  }

  @Post('apply')
  async applyPromotion(@Body() data: {
    code: string;
    userId: string;
    cartTotal: number;
    productIds: string[];
  }): Promise<{
    success: boolean;
    discount: number;
    message?: string;
  }> {
    this.logger.log(`Aplicando promoción con código ${data.code}`);
    try {
      return await this.promotionsService.applyPromotion(
        data.code,
        data.userId,
        data.cartTotal,
        data.productIds
      );
    } catch (error) {
      this.logger.error(`Error al aplicar promoción: ${error.message}`);
      throw error;
    }
  }
} 