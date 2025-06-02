import { Controller, Get, Query, Logger } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales')
  @ApiOperation({ summary: 'Obtener reporte de ventas' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiResponse({ status: 200, description: 'Reporte de ventas obtenido exitosamente' })
  async getSalesReport(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date
  ) {
    this.logger.log(`Obteniendo reporte de ventas desde ${startDate} hasta ${endDate}`);
    try {
      return await this.reportsService.getSalesReport(startDate, endDate);
    } catch (error) {
      this.logger.error(`Error al obtener reporte de ventas: ${error.message}`);
      throw error;
    }
  }

  @Get('promotions')
  @ApiOperation({ summary: 'Obtener reporte de promociones' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiResponse({ status: 200, description: 'Reporte de promociones obtenido exitosamente' })
  async getPromotionsReport(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date
  ) {
    this.logger.log(`Obteniendo reporte de promociones desde ${startDate} hasta ${endDate}`);
    try {
      return await this.reportsService.getPromotionsReport(startDate, endDate);
    } catch (error) {
      this.logger.error(`Error al obtener reporte de promociones: ${error.message}`);
      throw error;
    }
  }

  @Get('users')
  @ApiOperation({ summary: 'Obtener reporte de usuarios' })
  @ApiQuery({ name: 'startDate', required: true, type: Date })
  @ApiQuery({ name: 'endDate', required: true, type: Date })
  @ApiResponse({ status: 200, description: 'Reporte de usuarios obtenido exitosamente' })
  async getUsersReport(
    @Query('startDate') startDate: Date,
    @Query('endDate') endDate: Date
  ) {
    this.logger.log(`Obteniendo reporte de usuarios desde ${startDate} hasta ${endDate}`);
    try {
      return await this.reportsService.getUsersReport(startDate, endDate);
    } catch (error) {
      this.logger.error(`Error al obtener reporte de usuarios: ${error.message}`);
      throw error;
    }
  }
} 