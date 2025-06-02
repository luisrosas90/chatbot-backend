import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { 
  WhatsAppProvider, 
  WhatsAppMessage, 
  WhatsAppStatus, 
  WhatsAppConfig,
  WhatsAppWebhookConfig
} from '../../interfaces/whatsapp-provider.interface';

@Injectable()
export class EvolutionApiService implements WhatsAppProvider {
  private readonly logger = new Logger(EvolutionApiService.name);
  private defaultApiUrl: string;
  private defaultApiKey: string;

  constructor(private configService: ConfigService) {
    this.defaultApiUrl = this.configService.get<string>('evolution.apiUrl');
    this.defaultApiKey = this.configService.get<string>('evolution.apiKey');
  }

  private getHeaders(apiKey: string): any {
    return {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Accept': '*/*'
    };
  }

  private getBaseUrl(config: WhatsAppConfig): string {
    return `${config.apiUrl}/chat-api`;
  }

  async sendMessage(to: string, message: string, config: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Normalizar el número de teléfono
      to = this.normalizePhoneNumber(to);
      
      // Enviar mensaje
      const response = await axios.post(
        `${baseUrl}/send-message/${instanceId}`,
        {
          number: to,
          options: {
            delay: 1200
          },
          textMessage: {
            text: message
          }
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );

      if (response.data && response.data.key) {
        this.logger.log(`Mensaje enviado exitosamente a ${to} (${response.data.key.id})`);
        
        return {
          id: response.data.key.id,
          from: instanceId,
          to: to,
          body: message,
          status: 'sent',
          timestamp: new Date(),
          type: 'text',
          instanceId: instanceId
        };
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error enviando mensaje: ${error.message}`);
      throw error;
    }
  }

  async sendImage(to: string, imageUrl: string, caption: string, config: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Normalizar el número de teléfono
      to = this.normalizePhoneNumber(to);
      
      // Enviar imagen
      const response = await axios.post(
        `${baseUrl}/send-media/${instanceId}`,
        {
          number: to,
          options: {
            delay: 1200
          },
          mediaMessage: {
            mediatype: "image",
            media: imageUrl,
            caption: caption
          }
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );

      if (response.data && response.data.key) {
        this.logger.log(`Imagen enviada exitosamente a ${to} (${response.data.key.id})`);
        
        return {
          id: response.data.key.id,
          from: instanceId,
          to: to,
          body: caption,
          status: 'sent',
          timestamp: new Date(),
          type: 'image',
          instanceId: instanceId,
          metadata: {
            imageUrl: imageUrl
          }
        };
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error enviando imagen: ${error.message}`);
      throw error;
    }
  }

  async sendDocument(to: string, documentUrl: string, filename: string, config: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Normalizar el número de teléfono
      to = this.normalizePhoneNumber(to);
      
      // Enviar documento
      const response = await axios.post(
        `${baseUrl}/send-media/${instanceId}`,
        {
          number: to,
          options: {
            delay: 1200
          },
          mediaMessage: {
            mediatype: "document",
            media: documentUrl,
            fileName: filename
          }
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );

      if (response.data && response.data.key) {
        this.logger.log(`Documento enviado exitosamente a ${to} (${response.data.key.id})`);
        
        return {
          id: response.data.key.id,
          from: instanceId,
          to: to,
          body: filename,
          status: 'sent',
          timestamp: new Date(),
          type: 'document',
          instanceId: instanceId,
          metadata: {
            documentUrl: documentUrl,
            filename: filename
          }
        };
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error enviando documento: ${error.message}`);
      throw error;
    }
  }

  async sendAudio(to: string, audioUrl: string, config: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Normalizar el número de teléfono
      to = this.normalizePhoneNumber(to);
      
      // Intentar primero determinar si es una URL o un archivo local
      let mediaUrl = audioUrl;
      
      // Verificar si necesitamos codificar en base64
      if (audioUrl.startsWith('http') && !audioUrl.includes('base64')) {
        try {
          // Descargar el audio para enviarlo como base64
          this.logger.log(`Descargando audio desde ${audioUrl} para enviar como PTT`);
          
          const audioResponse = await axios.get(audioUrl, {
            responseType: 'arraybuffer',
            headers: {
              'Accept': '*/*',
              'User-Agent': 'WhatsApp/2.23.24.82 A'
            }
          });
          
          // Convertir a base64
          const base64Audio = Buffer.from(audioResponse.data).toString('base64');
          
          // Usar el formato de datos base64 para Evolution API
          mediaUrl = `data:audio/ogg;base64,${base64Audio}`;
          this.logger.log(`Audio convertido a base64 (${base64Audio.length} caracteres)`);
        } catch (downloadError) {
          this.logger.error(`Error descargando audio: ${downloadError.message}, intentando con URL directa`);
          // Usar la URL directa si falla la descarga
          mediaUrl = audioUrl;
        }
      }
      
      // Enviar audio como PTT (push-to-talk)
      const response = await axios.post(
        `${baseUrl}/send-media/${instanceId}`,
        {
          number: to,
          options: {
            delay: 1200,
            presence: "recording" // Simular que estamos grabando antes de enviar
          },
          mediaMessage: {
            mediatype: "audio",
            media: mediaUrl,
            // Configurar como PTT
            ptt: true
          }
        },
        {
          headers: this.getHeaders(apiKey),
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      if (response.data && response.data.key) {
        this.logger.log(`Audio enviado exitosamente a ${to} (${response.data.key.id})`);
        
        return {
          id: response.data.key.id,
          from: instanceId,
          to: to,
          body: "Audio",
          status: 'sent',
          timestamp: new Date(),
          type: 'audio',
          instanceId: instanceId,
          metadata: {
            audioUrl: audioUrl
          }
        };
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error enviando audio: ${error.message}`);
      throw error;
    }
  }

  async sendLocation(to: string, latitude: number, longitude: number, config: WhatsAppConfig): Promise<WhatsAppMessage> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Normalizar el número de teléfono
      to = this.normalizePhoneNumber(to);
      
      // Enviar ubicación
      const response = await axios.post(
        `${baseUrl}/send-location/${instanceId}`,
        {
          number: to,
          options: {
            delay: 1200
          },
          locationMessage: {
            latitude: latitude,
            longitude: longitude
          }
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );

      if (response.data && response.data.key) {
        this.logger.log(`Ubicación enviada exitosamente a ${to} (${response.data.key.id})`);
        
        return {
          id: response.data.key.id,
          from: instanceId,
          to: to,
          body: `Ubicación: ${latitude},${longitude}`,
          status: 'sent',
          timestamp: new Date(),
          type: 'location',
          instanceId: instanceId,
          metadata: {
            latitude: latitude,
            longitude: longitude
          }
        };
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error enviando ubicación: ${error.message}`);
      throw error;
    }
  }

  async getStatus(config: WhatsAppConfig): Promise<WhatsAppStatus> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      const response = await axios.get(
        `${baseUrl}/instance/connectionState/${instanceId}`,
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      if (response.data && response.data.state) {
        const state = response.data.state;
        
        let status: WhatsAppStatus = {
          state: 'disconnected',
          description: state
        };
        
        // Mapear estados de Evolution API a estados genéricos
        if (state === 'open') {
          status.state = 'connected';
        } else if (state === 'connecting') {
          status.state = 'connecting';
        } else if (state.includes('qrcode')) {
          status.state = 'require_qr';
          
          // Obtener QR si está disponible
          try {
            const qrResponse = await axios.get(
              `${baseUrl}/instance/qrcode/${instanceId}?image=true`,
              {
                headers: this.getHeaders(apiKey)
              }
            );
            
            if (qrResponse.data && qrResponse.data.qrcode) {
              status.qrCode = qrResponse.data.qrcode;
            }
          } catch (qrError) {
            this.logger.warn(`Error obteniendo QR: ${qrError.message}`);
          }
        }
        
        return status;
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error obteniendo estado: ${error.message}`);
      
      // Devolver un estado genérico de error
      return {
        state: 'error',
        description: error.message
      };
    }
  }

  async getMediaBase64(messageId: string, config: WhatsAppConfig): Promise<string | null> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      this.logger.log(`Obteniendo media en base64 para mensaje ${messageId} en instancia ${instanceId}`);
      
      // Llamar a la API para obtener el contenido multimedia en base64
      const response = await axios.get(
        `${baseUrl}/get-media-base64/${instanceId}`,
        {
          params: {
            messageId: messageId,
            convertToMp4: false // Para audio, no necesitamos convertir a mp4
          },
          headers: this.getHeaders(apiKey),
          timeout: 20000 // Mayor timeout para archivos grandes
        }
      );
      
      if (response.data && response.data.data && response.data.data.base64) {
        const base64Data = response.data.data.base64;
        this.logger.log(`Base64 obtenido correctamente (${base64Data.length} caracteres)`);
        return base64Data;
      } else {
        this.logger.warn('No se encontró datos base64 en la respuesta');
        return null;
      }
    } catch (error) {
      this.logger.error(`Error obteniendo media en base64: ${error.message}`);
      return null;
    }
  }

  async create(config: WhatsAppConfig): Promise<WhatsAppStatus> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Verificar si la instancia ya existe
      try {
        const statusResponse = await this.getStatus(config);
        
        // Si la instancia existe y no está en error, devolverla
        if (statusResponse.state !== 'error') {
          this.logger.log(`Instancia ${instanceId} ya existe con estado: ${statusResponse.state}`);
          return statusResponse;
        }
      } catch (statusError) {
        this.logger.log(`La instancia ${instanceId} no existe o está en error, creándola...`);
      }
      
      // Crear nueva instancia
      const response = await axios.post(
        `${baseUrl}/instance/create`,
        {
          instanceName: instanceId
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      if (response.data && response.data.instance) {
        this.logger.log(`Instancia ${instanceId} creada exitosamente`);
        
        // Conectar la instancia después de crearla
        await axios.post(
          `${baseUrl}/instance/connect/${instanceId}`,
          {},
          {
            headers: this.getHeaders(apiKey)
          }
        );
        
        // Obtener estado actualizado
        return await this.getStatus(config);
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error creando instancia: ${error.message}`);
      throw error;
    }
  }

  async disconnect(config: WhatsAppConfig): Promise<WhatsAppStatus> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Desconectar la instancia
      await axios.post(
        `${baseUrl}/instance/logout/${instanceId}`,
        {},
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      this.logger.log(`Instancia ${instanceId} desconectada exitosamente`);
      
      // Devolver estado desconectado
      return {
        state: 'disconnected',
        description: 'Manually disconnected'
      };
    } catch (error) {
      this.logger.error(`Error desconectando instancia: ${error.message}`);
      throw error;
    }
  }

  async delete(config: WhatsAppConfig): Promise<boolean> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Primero desconectar
      try {
        await this.disconnect(config);
      } catch (disconnectError) {
        this.logger.warn(`Error al desconectar instancia antes de eliminar: ${disconnectError.message}`);
      }
      
      // Eliminar la instancia
      await axios.delete(
        `${baseUrl}/instance/delete/${instanceId}`,
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      this.logger.log(`Instancia ${instanceId} eliminada exitosamente`);
      return true;
    } catch (error) {
      this.logger.error(`Error eliminando instancia: ${error.message}`);
      return false;
    }
  }

  async configureWebhook(webhookConfig: WhatsAppWebhookConfig, config: WhatsAppConfig): Promise<boolean> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      // Configurar webhook
      const response = await axios.post(
        `${baseUrl}/webhook/set/${instanceId}`,
        {
          webhookUrl: webhookConfig.url,
          events: webhookConfig.events || [
            'messages',
            'message.ack',
            'connection.update'
          ],
          webhook_by_events: false, // Enviar todos los eventos a la misma URL
          webhook_base64: true, // Incluir contenido multimedia en base64
          webhook_secret: webhookConfig.secret || '' // Clave secreta opcional
        },
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      if (response.data && response.data.set) {
        this.logger.log(`Webhook configurado exitosamente para instancia ${instanceId}`);
        return true;
      } else {
        throw new Error('Respuesta incompleta del API');
      }
    } catch (error) {
      this.logger.error(`Error configurando webhook: ${error.message}`);
      throw error;
    }
  }
  
  private validateConfig(config: WhatsAppConfig): { instanceId: string, apiUrl: string, apiKey: string } {
    // Verificar y usar valores por defecto si es necesario
    const instanceId = config.instanceId;
    const apiUrl = config.apiUrl || this.defaultApiUrl;
    const apiKey = config.apiKey || this.defaultApiKey;
    
    if (!instanceId) {
      throw new Error('ID de instancia no proporcionado');
    }
    
    if (!apiUrl) {
      throw new Error('URL de API no proporcionada');
    }
    
    if (!apiKey) {
      throw new Error('Clave de API no proporcionada');
    }
    
    return { instanceId, apiUrl, apiKey };
  }
  
  private normalizePhoneNumber(phone: string): string {
    // Eliminar caracteres no numéricos
    let normalized = phone.replace(/\D/g, '');
    
    // Asegurar que el número tiene el formato correcto para WhatsApp
    // Debe ser código de país + número, sin prefijos como + o 00
    if (normalized.startsWith('00')) {
      normalized = normalized.substring(2);
    } else if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    
    return normalized;
  }

  // Implementar métodos requeridos por la interfaz WhatsAppProvider
  
  async initialize(config: WhatsAppConfig): Promise<any> {
    return await this.create(config);
  }
  
  async getQRCode(config: WhatsAppConfig): Promise<string> {
    try {
      const { instanceId, apiUrl, apiKey } = this.validateConfig(config);
      const baseUrl = this.getBaseUrl(config);
      
      const response = await axios.get(
        `${baseUrl}/instance/qrcode/${instanceId}?image=true`,
        {
          headers: this.getHeaders(apiKey)
        }
      );
      
      if (response.data && response.data.qrcode) {
        return response.data.qrcode;
      } else {
        throw new Error('QR code no disponible');
      }
    } catch (error) {
      this.logger.error(`Error obteniendo QR code: ${error.message}`);
      throw error;
    }
  }
  
  async updateConfig(config: WhatsAppConfig): Promise<void> {
    // Almacenar la configuración actualizada
    if (config.apiUrl) {
      this.defaultApiUrl = config.apiUrl;
    }
    
    if (config.apiKey) {
      this.defaultApiKey = config.apiKey;
    }
    
    this.logger.log(`Configuración actualizada para la instancia ${config.instanceId}`);
  }
  
  async getConfig(config?: WhatsAppConfig): Promise<any> {
    // Si se proporciona un config, devolver una combinación de ese config con los valores por defecto
    if (config && config.instanceId) {
      return {
        instanceId: config.instanceId,
        apiUrl: config.apiUrl || this.defaultApiUrl,
        apiKey: config.apiKey || this.defaultApiKey,
        // Otros parámetros de configuración podrían ir aquí
      };
    }
    
    // Si no se proporciona un config, devolver la configuración por defecto
    return {
      apiUrl: this.defaultApiUrl,
      apiKey: this.defaultApiKey
    };
  }
} 