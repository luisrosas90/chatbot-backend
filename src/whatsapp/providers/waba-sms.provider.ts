import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WhatsAppProvider, WhatsAppMessage, WhatsAppStatus, WhatsAppConfig } from '../interfaces/whatsapp-provider.interface';

@Injectable()
export class WabaSmsProvider implements WhatsAppProvider {
  private readonly logger = new Logger(WabaSmsProvider.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.apiUrl = 'https://crm.wabasms.com/api/v1';
    this.apiKey = this.configService.get<string>('WHATSAPP_API_KEY');
  }

  async initialize(config?: WhatsAppConfig): Promise<any> {
    try {
      // No se necesita inicialización específica para Waba SMS
      this.logger.log('Proveedor Waba SMS inicializado exitosamente');
      
      return {
        success: true,
        message: 'Inicializado correctamente'
      };
    } catch (error) {
      this.logger.error(`Error inicializando Waba SMS: ${error.message}`);
      throw error;
    }
  }

  async disconnect(config?: WhatsAppConfig): Promise<WhatsAppStatus> {
    // No se necesita desconexión específica para Waba SMS
    return {
      state: 'disconnected',
      description: 'Instancia desconectada (simulado)'
    };
  }

  async sendMessage(to: string, message: string, config?: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const instanceId = config?.instanceId || 'default';
      
      const response = await axios.get(
        `${this.apiUrl}/send-text`,
        {
          params: {
            token: this.apiKey,
            instance_id: instanceId,
            jid: to,
            msg: message
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error enviando mensaje');
      }

      return {
        from: 'system',
        to,
        body: message,
        timestamp: new Date(),
        type: 'text',
        instanceId,
        messageId: response.data.response || ''
      };
    } catch (error) {
      this.logger.error(`Error enviando mensaje: ${error.message}`);
      throw error;
    }
  }

  async sendImage(to: string, imageUrl: string, caption: string, config?: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const instanceId = config?.instanceId || 'default';
      
      const response = await axios.get(
        `${this.apiUrl}/send-image`,
        {
          params: {
            token: this.apiKey,
            instance_id: instanceId,
            jid: to,
            caption,
            imageurl: imageUrl
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error enviando imagen');
      }

      return {
        from: 'system',
        to,
        body: caption,
        timestamp: new Date(),
        type: 'image',
        instanceId,
        messageId: response.data.response || '',
        metadata: { imageUrl }
      };
    } catch (error) {
      this.logger.error(`Error enviando imagen: ${error.message}`);
      throw error;
    }
  }

  async sendDocument(to: string, documentUrl: string, caption: string, config?: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const instanceId = config?.instanceId || 'default';
      
      const response = await axios.get(
        `${this.apiUrl}/send-doc`,
        {
          params: {
            token: this.apiKey,
            instance_id: instanceId,
            jid: to,
            caption,
            docurl: documentUrl
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error enviando documento');
      }

      return {
        from: 'system',
        to,
        body: caption,
        timestamp: new Date(),
        type: 'document',
        instanceId,
        messageId: response.data.response || '',
        metadata: { documentUrl }
      };
    } catch (error) {
      this.logger.error(`Error enviando documento: ${error.message}`);
      throw error;
    }
  }

  async sendAudio(to: string, audioUrl: string, config?: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const instanceId = config?.instanceId || 'default';
      
      const response = await axios.get(
        `${this.apiUrl}/send-audio`,
        {
          params: {
            token: this.apiKey,
            instance_id: instanceId,
            jid: to,
            audiourl: audioUrl
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error enviando audio');
      }

      return {
        from: 'system',
        to,
        body: 'Audio',
        timestamp: new Date(),
        type: 'audio',
        instanceId,
        messageId: response.data.response || '',
        metadata: { audioUrl }
      };
    } catch (error) {
      this.logger.error(`Error enviando audio: ${error.message}`);
      throw error;
    }
  }

  async sendLocation(to: string, latitude: number, longitude: number, config?: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const instanceId = config?.instanceId || 'default';
      
      const response = await axios.get(
        `${this.apiUrl}/send-location`,
        {
          params: {
            token: this.apiKey,
            instance_id: instanceId,
            jid: to,
            lat: latitude,
            lng: longitude
          }
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.message || 'Error enviando ubicación');
      }

      return {
        from: 'system',
        to,
        body: `Ubicación: ${latitude},${longitude}`,
        timestamp: new Date(),
        type: 'location',
        instanceId,
        messageId: response.data.response || '',
        metadata: { latitude, longitude }
      };
    } catch (error) {
      this.logger.error(`Error enviando ubicación: ${error.message}`);
      throw error;
    }
  }

  async getQRCode(config?: WhatsAppConfig): Promise<string> {
    // No implementado para Waba SMS
    throw new Error('Método no soportado en Waba SMS');
  }

  async updateConfig(config: WhatsAppConfig): Promise<void> {
    // No implementado para Waba SMS
    this.logger.log(`Configuración actualizada (simulado): ${JSON.stringify(config)}`);
    return;
  }

  async getConfig(config?: WhatsAppConfig): Promise<any> {
    // No implementado para Waba SMS
    return {
      provider: 'waba-sms',
      apiUrl: this.apiUrl,
      instanceId: config?.instanceId || 'default'
    };
  }
} 