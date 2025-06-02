import { Controller, Get, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen del dashboard' })
  @ApiResponse({ status: 200, description: 'Resumen del dashboard obtenido exitosamente' })
  async getDashboardSummary() {
    this.logger.log('Obteniendo resumen del dashboard');
    try {
      return await this.dashboardService.getDashboardSummary();
    } catch (error) {
      this.logger.error(`Error al obtener resumen del dashboard: ${error.message}`);
      throw error;
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Obtener estado de salud del sistema' })
  @ApiResponse({ status: 200, description: 'Estado de salud del sistema obtenido exitosamente' })
  async getSystemHealth() {
    this.logger.log('Obteniendo estado de salud del sistema');
    try {
      return await this.dashboardService.getSystemHealth();
    } catch (error) {
      this.logger.error(`Error al obtener estado de salud del sistema: ${error.message}`);
      throw error;
    }
  }

  @Get('activity')
  @ApiOperation({ summary: 'Obtener actividad reciente' })
  @ApiResponse({ status: 200, description: 'Actividad reciente obtenida exitosamente' })
  async getRecentActivity() {
    this.logger.log('Obteniendo actividad reciente');
    try {
      return await this.dashboardService.getRecentActivity();
    } catch (error) {
      this.logger.error(`Error al obtener actividad reciente: ${error.message}`);
      throw error;
    }
  }
} 