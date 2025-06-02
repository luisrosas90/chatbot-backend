import { Controller, Post, Body, Logger } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private notificationsService: NotificationsService) {}

  @Post('order-confirmation')
  async sendOrderConfirmation(@Body() data: { phoneNumber: string; orderDetails: any }) {
    this.logger.log(`Enviando confirmación de orden a ${data.phoneNumber}`);
    try {
      await this.notificationsService.sendOrderConfirmation(data.phoneNumber, data.orderDetails);
      return { success: true, message: 'Notificación enviada exitosamente' };
    } catch (error) {
      this.logger.error(`Error al enviar confirmación de orden: ${error.message}`);
      throw error;
    }
  }

  @Post('payment-reminder')
  async sendPaymentReminder(@Body() data: { phoneNumber: string; orderDetails: any }) {
    this.logger.log(`Enviando recordatorio de pago a ${data.phoneNumber}`);
    try {
      await this.notificationsService.sendPaymentReminder(data.phoneNumber, data.orderDetails);
      return { success: true, message: 'Recordatorio enviado exitosamente' };
    } catch (error) {
      this.logger.error(`Error al enviar recordatorio de pago: ${error.message}`);
      throw error;
    }
  }

  @Post('order-status')
  @ApiOperation({ summary: 'Enviar actualización de estado de orden' })
  @ApiResponse({ status: 200, description: 'Notificación enviada exitosamente' })
  async sendOrderStatusUpdate(@Body() data: { phoneNumber: string; orderNumber: string; status: string }) {
    try {
      await this.notificationsService.sendOrderStatusUpdate(
        data.phoneNumber,
        data.orderNumber,
        data.status
      );
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error al enviar actualización de estado: ${error.message}`);
      throw error;
    }
  }

  @Post('abandoned-cart')
  async sendAbandonedCartReminder(@Body() data: { phoneNumber: string; cartDetails: any }) {
    this.logger.log(`Enviando recordatorio de carrito abandonado a ${data.phoneNumber}`);
    try {
      await this.notificationsService.sendAbandonedCartReminder(data.phoneNumber, data.cartDetails);
      return { success: true, message: 'Recordatorio enviado exitosamente' };
    } catch (error) {
      this.logger.error(`Error al enviar recordatorio de carrito abandonado: ${error.message}`);
      throw error;
    }
  }
} 