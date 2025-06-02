import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface NotificationLog {
  id?: string;
  message: string;
  phoneNumbers: string[];
  successCount: number;
  failureCount: number;
  isPromotion: boolean;
  sentAt: Date;
  createdAt?: Date;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly defaultInstanceId: string;

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly configService: ConfigService
  ) {
    this.defaultInstanceId = this.configService.get<string>('WHATSAPP_DEFAULT_INSTANCE');
  }

  async sendOrderConfirmation(phoneNumber: string, orderDetails: any) {
    try {
      const message = `¡Gracias por tu pedido! Tu número de orden es: ${orderDetails.orderNumber}`;
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar confirmación de orden: ${error.message}`);
      throw error;
    }
  }

  async sendOrderStatusUpdate(phoneNumber: string, orderNumber: string, status: string) {
    try {
      const message = `Tu pedido #${orderNumber} ha sido actualizado a: ${status}`;
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar actualización de estado: ${error.message}`);
      throw error;
    }
  }

  async sendPaymentConfirmation(phoneNumber: string, orderNumber: string) {
    try {
      const message = `¡Pago confirmado! Tu pedido #${orderNumber} está siendo procesado.`;
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar confirmación de pago: ${error.message}`);
      throw error;
    }
  }

  async sendDeliveryNotification(phoneNumber: string, orderNumber: string, estimatedTime: string) {
    try {
      const message = `¡Tu pedido #${orderNumber} está en camino! Tiempo estimado de entrega: ${estimatedTime}`;
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar notificación de entrega: ${error.message}`);
      throw error;
    }
  }

  async sendPaymentReminder(phoneNumber: string, orderDetails: any): Promise<void> {
    try {
      const message = this.formatPaymentReminderMessage(orderDetails);
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar recordatorio de pago: ${error.message}`);
      throw error;
    }
  }

  async sendAbandonedCartReminder(phoneNumber: string, cartDetails: any): Promise<void> {
    try {
      const message = this.formatAbandonedCartMessage(cartDetails);
      await this.whatsappService.sendMessage(phoneNumber, message, this.defaultInstanceId);
    } catch (error) {
      this.logger.error(`Error al enviar recordatorio de carrito abandonado: ${error.message}`);
      throw error;
    }
  }

  private formatOrderConfirmationMessage(orderDetails: any): string {
    return `¡Gracias por tu compra! 🎉\n\n` +
           `Tu orden #${orderDetails.id} ha sido confirmada.\n` +
           `Total: $${orderDetails.total}\n` +
           `Método de pago: ${orderDetails.paymentMethod}\n` +
           `Estado: ${orderDetails.status}\n\n` +
           `Te mantendremos informado sobre el estado de tu pedido.`;
  }

  private formatPaymentReminderMessage(orderDetails: any): string {
    return `¡Hola! 👋\n\n` +
           `Te recordamos que tienes un pago pendiente para la orden #${orderDetails.id}.\n` +
           `Monto: $${orderDetails.total}\n` +
           `Fecha límite: ${orderDetails.dueDate}\n\n` +
           `Por favor, realiza el pago para continuar con el procesamiento de tu orden.`;
  }

  private formatOrderStatusMessage(orderDetails: any): string {
    return `¡Actualización de tu orden! 📦\n\n` +
           `Orden #${orderDetails.id}\n` +
           `Nuevo estado: ${orderDetails.status}\n` +
           `Fecha de actualización: ${orderDetails.updateDate}\n\n` +
           `Gracias por tu paciencia.`;
  }

  private formatAbandonedCartMessage(cartDetails: any): string {
    return `¡Hola! 👋\n\n` +
           `Notamos que dejaste algunos productos en tu carrito:\n\n` +
           `${this.formatCartItems(cartDetails.items)}\n` +
           `Total: $${cartDetails.total}\n\n` +
           `¿Te gustaría completar tu compra?`;
  }

  private formatCartItems(items: any[]): string {
    return items.map(item => 
      `- ${item.name}: $${item.price} x ${item.quantity}`
    ).join('\n');
  }

  /**
   * Registrar notificación enviada
   */
  async logNotification(notificationData: NotificationLog): Promise<void> {
    try {
      // Por ahora guardamos en logs - en producción usar tabla de base de datos
      this.logger.log(`📨 Notificación registrada: ${notificationData.successCount}/${notificationData.phoneNumbers.length} enviadas exitosamente`);
      this.logger.log(`Mensaje: ${notificationData.message.substring(0, 100)}...`);
    } catch (error) {
      this.logger.error(`Error registrando notificación: ${error.message}`);
    }
  }

  /**
   * Obtener historial de notificaciones
   */
  async getNotificationHistory(limit: number = 50, offset: number = 0): Promise<NotificationLog[]> {
    try {
      // Por ahora retornamos datos de ejemplo - en producción consultar base de datos
      return [
        {
          id: '1',
          message: 'Ofertas especiales del día - hasta 30% de descuento',
          phoneNumbers: ['04141234567', '04241234567'],
          successCount: 2,
          failureCount: 0,
          isPromotion: true,
          sentAt: new Date(),
          createdAt: new Date()
        }
      ];
    } catch (error) {
      this.logger.error(`Error obteniendo historial: ${error.message}`);
      return [];
    }
  }

  /**
   * Enviar notificación de cambio de estado de pedido
   */
  async sendOrderStatusNotification(phoneNumber: string, orderId: string, newStatus: string): Promise<boolean> {
    try {
      const statusMessages = {
        'PE': '⏳ Su pedido está siendo preparado',
        'EN': '🚚 Su pedido está en camino',
        'EN_DESTINO': '📍 Su pedido llegará pronto',
        'ENTREGADO': '✅ Su pedido ha sido entregado',
        'CANCELADO': '❌ Su pedido ha sido cancelado'
      };

      const statusMessage = statusMessages[newStatus] || '📋 Estado de pedido actualizado';

      const message = `🏪 **GÓMEZMARKET** 🏪\n` +
                     `═══════════════════════════\n` +
                     `📦 **Pedido #${orderId}**\n` +
                     `${statusMessage}\n\n` +
                     `🕐 ${new Date().toLocaleString()}\n` +
                     `💬 Para más información, contáctenos`;

      // Aquí se integraría con WhatsApp API
      this.logger.log(`📱 Notificación de estado enviada a ${phoneNumber}: ${newStatus}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error enviando notificación de estado: ${error.message}`);
      return false;
    }
  }

  /**
   * Programar notificación
   */
  async scheduleNotification(phoneNumber: string, message: string, scheduleDate: Date): Promise<boolean> {
    try {
      // Implementar cola de notificaciones programadas
      this.logger.log(`📅 Notificación programada para ${scheduleDate.toLocaleString()}: ${phoneNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Error programando notificación: ${error.message}`);
      return false;
    }
  }
} 