import { Controller, Get, Post, Put, Delete, Body, Param, Query, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ChatbotService } from '../services/chatbot.service';
import { ConversationService } from '../services/conversation.service';
import { PromotionService } from '../services/promotion.service';
import { ReportService } from '../services/report.service';
import { AdminService } from '../services/admin.service';
import { CartsService } from '../../carts/carts.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { WhatsappService } from '../../whatsapp/whatsapp.service';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

@ApiTags('admin')
@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly adminService: AdminService,
    private readonly chatbotService: ChatbotService,
    private readonly conversationService: ConversationService,
    private readonly promotionService: PromotionService,
    private readonly reportService: ReportService,
    private readonly cartsService: CartsService,
    private readonly notificationsService: NotificationsService,
    private readonly whatsappService: WhatsappService,
  ) {}

  // ============================================================================
  // DASHBOARD PRINCIPAL
  // ============================================================================

  @Get('dashboard')
  @ApiOperation({ summary: 'Obtener datos del dashboard principal' })
  async getDashboard() {
    try {
      // Simular datos del dashboard hasta que se implementen los servicios reales
      return {
        chatbot: {
          activeSessions: 12,
          conversionRate: 23.5,
          topSearches: [
            { term: 'arroz', count: 45 },
            { term: 'pollo', count: 32 },
            { term: 'aceite', count: 28 }
          ]
        },
        orders: {
          ordersToday: 34,
          totalRevenue: 1250.75
        },
        carts: {
          totalAbandoned: 8,
          recoveryRate: 15.3
        },
        users: {
          totalUsers: 156,
          activeUsers: 89
        }
      };
    } catch (error) {
      this.logger.error('Error obteniendo datos del dashboard:', error);
      throw new HttpException('Error loading dashboard data', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('stats/realtime')
  @ApiOperation({ summary: 'Obtener estadísticas en tiempo real' })
  async getRealtimeStats() {
    return {
      activeSessions: 12,
      ordersToday: 34,
      messagesPerMinute: 5.2,
      systemHealth: 'healthy'
    };
  }

  // ============================================================================
  // CONFIGURACIÓN DEL CHATBOT
  // ============================================================================

  @Get('config/chatbot')
  @ApiOperation({ summary: 'Obtener configuración del chatbot' })
  async getChatbotConfig() {
    return {
      responseFormat: 'friendly',
      personality: 'helpful',
      responseDelay: 1,
      useEmojis: true,
      useReactionEmojis: false,
      maxCartItems: 50,
      maxSessionDuration: 2,
      enableAI: true,
      enableSentimentAnalysis: false,
      enableSpellCheck: true,
      autoCartReminders: true,
      autoOfferNotifications: true,
      autoOrderUpdates: true
    };
  }

  @Put('config/chatbot')
  @ApiOperation({ summary: 'Actualizar configuración del chatbot' })
  async updateChatbotConfig(@Body() config: any) {
    try {
      this.logger.log('Actualizando configuración del chatbot:', config);
      // Aquí se implementaría la lógica real de actualización
      return { message: 'Configuración actualizada exitosamente' };
    } catch (error) {
      throw new HttpException('Error updating configuration', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('config/general')
  @ApiOperation({ summary: 'Obtener configuración general' })
  async getGeneralConfig() {
    return {
      businessName: 'GómezMarket',
      businessHours: '9:00 AM - 6:00 PM',
      currency: 'USD',
      timezone: 'America/Caracas',
      autoResponses: true,
      maintenanceMode: false
    };
  }

  @Put('config/general')
  @ApiOperation({ summary: 'Actualizar configuración general' })
  async updateGeneralConfig(@Body() config: any) {
    try {
      this.logger.log('Actualizando configuración general:', config);
      return { message: 'Configuración general actualizada' };
    } catch (error) {
      throw new HttpException('Error updating general configuration', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ============================================================================
  // PLANTILLAS DE MENSAJES
  // ============================================================================

  @Get('templates')
  @ApiOperation({ summary: 'Obtener plantillas de mensajes' })
  async getMessageTemplates() {
    return [
      {
        id: 1,
        name: 'Saludo de Bienvenida',
        type: 'greeting',
        content: '¡Hola! 👋 Bienvenido a GómezMarket. ¿En qué puedo ayudarte hoy?',
        isActive: true,
        usageCount: 245
      },
      {
        id: 2,
        name: 'Ayuda General',
        type: 'help',
        content: 'Puedo ayudarte con: 🛒 Buscar productos 📦 Ver tu carrito 💳 Realizar pedidos ❓ Responder preguntas',
        isActive: true,
        usageCount: 89
      }
    ];
  }

  @Post('templates')
  @ApiOperation({ summary: 'Crear plantilla de mensaje' })
  async createMessageTemplate(@Body() template: any) {
    try {
      this.logger.log('Creando plantilla de mensaje:', template);
      return { id: Date.now(), ...template, isActive: true, usageCount: 0 };
    } catch (error) {
      throw new HttpException('Error creating template', HttpStatus.BAD_REQUEST);
    }
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Actualizar plantilla de mensaje' })
  async updateMessageTemplate(@Param('id') id: string, @Body() template: any) {
    try {
      this.logger.log(`Actualizando plantilla ${id}:`, template);
      return { id, ...template };
    } catch (error) {
      throw new HttpException('Error updating template', HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: 'Eliminar plantilla de mensaje' })
  async deleteMessageTemplate(@Param('id') id: string) {
    try {
      this.logger.log(`Eliminando plantilla ${id}`);
      return { message: 'Plantilla eliminada exitosamente' };
    } catch (error) {
      throw new HttpException('Error deleting template', HttpStatus.BAD_REQUEST);
    }
  }

  // ============================================================================
  // CARRITOS ABANDONADOS
  // ============================================================================

  @Get('carts/abandoned')
  @ApiOperation({ summary: 'Obtener carritos abandonados' })
  async getAbandonedCarts() {
    // Simular datos de carritos abandonados
    return [
      {
        id: 1,
        customerPhone: '+58414123456',
        customerName: 'Juan Pérez',
        itemCount: 3,
        total: 45.99,
        lastActivity: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 horas atrás
        products: [
          { name: 'Arroz Diana 1kg', price: 2.50 },
          { name: 'Aceite Mazeite 1L', price: 3.25 },
          { name: 'Pollo entero', price: 5.80 }
        ]
      },
      {
        id: 2,
        customerPhone: '+58424987654',
        customerName: 'María González',
        itemCount: 2,
        total: 28.75,
        lastActivity: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 horas atrás
        products: [
          { name: 'Leche Completa 1L', price: 1.85 },
          { name: 'Pan Integral', price: 1.25 }
        ]
      }
    ];
  }

  @Post('carts/send-recovery/:id')
  @ApiOperation({ summary: 'Enviar mensaje de recuperación de carrito' })
  async sendRecoveryMessage(@Param('id') cartId: string) {
    this.logger.log(`Enviando mensaje de recuperación para carrito ${cartId}`);
    return { 
      message: 'Mensaje de recuperación enviado exitosamente', 
      cartId,
      timestamp: new Date().toISOString()
    };
  }

  @Get('carts/stats')
  @ApiOperation({ summary: 'Obtener estadísticas de carritos' })
  async getCartsStats() {
    return {
      totalAbandoned: 8,
      recoveredToday: 2,
      recoveryRate: 15.3,
      averageValue: 42.75,
      totalValue: 342.0
    };
  }

  // ============================================================================
  // DESCUENTOS Y OFERTAS
  // ============================================================================

  @Get('discounts')
  @ApiOperation({ summary: 'Obtener descuentos activos' })
  async getActiveDiscounts() {
    return await this.promotionService.findActive();
  }

  @Post('discounts')
  @ApiOperation({ summary: 'Crear nuevo descuento' })
  async createDiscount(@Body() createDiscountDto: CreatePromotionDto) {
    try {
      return await this.promotionService.create(createDiscountDto);
    } catch (error) {
      throw new HttpException('Error creating discount', HttpStatus.BAD_REQUEST);
    }
  }

  @Put('discounts/:id')
  @ApiOperation({ summary: 'Actualizar descuento' })
  async updateDiscount(@Param('id') id: string, @Body() updateDiscountDto: UpdatePromotionDto) {
    try {
      return await this.promotionService.update(id, updateDiscountDto);
    } catch (error) {
      throw new HttpException('Error updating discount', HttpStatus.BAD_REQUEST);
    }
  }

  @Put('discounts/:id/toggle')
  @ApiOperation({ summary: 'Activar/desactivar descuento' })
  async toggleDiscount(@Param('id') id: string) {
    try {
      const discount = await this.promotionService.findOne(id);
      return await this.promotionService.update(id, { 
        isActive: !discount.isActive 
      });
    } catch (error) {
      throw new HttpException('Error toggling discount', HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('discounts/:id')
  @ApiOperation({ summary: 'Eliminar descuento' })
  async deleteDiscount(@Param('id') id: string) {
    try {
      await this.promotionService.remove(id);
      return { message: 'Descuento eliminado exitosamente' };
    } catch (error) {
      throw new HttpException('Error deleting discount', HttpStatus.BAD_REQUEST);
    }
  }

  // ============================================================================
  // NOTIFICACIONES
  // ============================================================================

  @Post('notifications/send')
  @ApiOperation({ summary: 'Enviar notificación masiva' })
  async sendBulkNotification(@Body() notificationData: any) {
    try {
      const { type, message, recipients } = notificationData;
      this.logger.log('Enviando notificación masiva:', { type, recipients: recipients?.length || 'all' });
      
      // Simular envío exitoso por ahora
      return {
        success: true,
        message: 'Notificación enviada exitosamente',
        sentTo: recipients?.length || 'all users',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new HttpException('Error sending notifications', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('notifications/history')
  @ApiOperation({ summary: 'Obtener historial de notificaciones' })
  async getNotificationHistory(@Query('limit') limit: number = 50) {
    // Simular historial de notificaciones
    return [
      {
        id: 1,
        type: 'promotion',
        title: 'Promoción Enviada',
        message: 'Descuento del 20% enviado a clientes activos',
        time: 'hace 2 horas',
        recipients: 156,
        status: 'sent'
      },
      {
        id: 2,
        type: 'cart',
        title: 'Recordatorio de Carrito',
        message: 'Recordatorio enviado a carritos abandonados',
        time: 'hace 4 horas',
        recipients: 23,
        status: 'sent'
      }
    ];
  }

  @Get('notifications/stats')
  @ApiOperation({ summary: 'Obtener estadísticas de notificaciones' })
  async getNotificationStats() {
    return {
      sentToday: 127,
      readRate: 89,
      responseRate: 32,
      totalSent: 1543
    };
  }

  // ============================================================================
  // REPORTES
  // ============================================================================

  @Get('reports')
  @ApiOperation({ summary: 'Obtener reportes generales' })
  async getReports(@Query('range') range: string = 'week') {
    try {
      const dateRange = this.getDateRange(range);
      
      return {
        sales: await this.reportService.getSalesReport(dateRange.start, dateRange.end),
        conversations: await this.reportService.getConversationReport(dateRange.start, dateRange.end),
        promotions: await this.reportService.getPromotionReport(dateRange.start, dateRange.end),
        users: await this.reportService.getUserReport()
      };
    } catch (error) {
      throw new HttpException('Error generating reports', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('reports/:type/download')
  @ApiOperation({ summary: 'Descargar reporte en PDF' })
  async downloadReport(@Param('type') type: string, @Query('range') range: string = 'week') {
    try {
      const dateRange = this.getDateRange(range);
      
      switch (type) {
        case 'sales':
          return await this.reportService.getSalesReport(dateRange.start, dateRange.end);
        case 'customers':
          return await this.reportService.getUserReport();
        case 'products':
          return { topProducts: [] }; // Implementar según necesidad
        case 'chatbot':
          return await this.reportService.getConversationReport(dateRange.start, dateRange.end);
        default:
          throw new HttpException('Invalid report type', HttpStatus.BAD_REQUEST);
      }
    } catch (error) {
      throw new HttpException('Error downloading report', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ============================================================================
  // SESIONES ACTIVAS
  // ============================================================================

  @Get('sessions')
  @ApiOperation({ summary: 'Obtener sesiones activas' })
  async getActiveSessions() {
    return [
      {
        id: 1,
        phone: '+58414123456',
        name: 'Juan Pérez',
        status: 'active',
        lastMessage: 'Quiero ver el menú de productos disponibles',
        lastMessageTime: new Date(Date.now() - 2 * 60 * 1000),
        duration: '15 min',
        cartItems: 3,
        cartValue: 45.99
      },
      {
        id: 2,
        phone: '+58424987654',
        name: 'María González',
        status: 'ordering',
        lastMessage: 'Quiero agregar 2 kilos de arroz al carrito',
        lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
        duration: '8 min',
        cartItems: 1,
        cartValue: 12.50
      }
    ];
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Obtener detalles de sesión' })
  async getSessionDetails(@Param('id') sessionId: string) {
    // Simular detalles de sesión
    return {
      id: sessionId,
      phone: '+58414123456',
      name: 'Juan Pérez',
      status: 'active',
      startTime: new Date(Date.now() - 15 * 60 * 1000),
      lastActivity: new Date(Date.now() - 2 * 60 * 1000),
      messageCount: 12,
      cart: {
        items: 3,
        total: 45.99,
        products: [
          { name: 'Arroz Diana 1kg', quantity: 2, price: 2.50 },
          { name: 'Aceite Mazeite 1L', quantity: 1, price: 3.25 }
        ]
      }
    };
  }

  @Put('sessions/:id')
  @ApiOperation({ summary: 'Actualizar sesión' })
  async updateSession(@Param('id') sessionId: string, @Body() updateData: any) {
    this.logger.log(`Actualizando sesión ${sessionId}:`, updateData);
    return { message: 'Sesión actualizada exitosamente', sessionId, updateData };
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Finalizar sesión' })
  async endSession(@Param('id') sessionId: string) {
    try {
      this.logger.log(`Finalizando sesión ${sessionId}`);
      return { message: 'Sesión finalizada exitosamente' };
    } catch (error) {
      throw new HttpException('Error ending session', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('sessions/:id/message')
  @ApiOperation({ summary: 'Enviar mensaje a sesión' })
  async sendMessageToSession(@Param('id') sessionId: string, @Body() messageData: any) {
    try {
      const { message, chatbotId } = messageData;
      this.logger.log(`Enviando mensaje a sesión ${sessionId}:`, message);
      // return await this.whatsappService.sendMessage(sessionId, message, chatbotId);
      return { success: true, message: 'Mensaje enviado exitosamente', sessionId };
    } catch (error) {
      throw new HttpException('Error sending message', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ============================================================================
  // UTILIDADES PRIVADAS
  // ============================================================================

  private getDateRange(range: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (range) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start.setDate(now.getDate() - 7);
    }

    return { start, end };
  }
} 