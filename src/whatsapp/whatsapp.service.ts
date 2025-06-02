/**
 * Servicio para manejar las interacciones con la API de WhatsApp.
 * Este servicio proporciona métodos para enviar mensajes, configurar webhooks
 * y gestionar el estado de las conexiones.
 * 
 * @class WhatsappService
 */
import { Injectable, Inject, OnModuleInit, Logger, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValeryChatbotService } from '../valery/valery-chatbot.service';
import { WhatsAppProvider, WhatsAppMessage, WhatsAppConfig, WhatsAppWebhookConfig } from './interfaces/whatsapp-provider.interface';
import { ChatService } from '../chat/chat.service';
import { Chatbot } from '../admin/entities/chatbot.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private activeProvider: WhatsAppProvider;
  private providers: { [key: string]: WhatsAppProvider };
  private chatbotInstances: Map<string, WhatsAppProvider> = new Map();

  constructor(
    @Inject('WHATSAPP_PROVIDERS') providers: { [key: string]: WhatsAppProvider },
    private configService: ConfigService,
    private valeryChatbotService: ValeryChatbotService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @InjectRepository(Chatbot, 'users')
    private chatbotRepository: Repository<Chatbot>
  ) {
    this.apiUrl = this.configService.get<string>('WHATSAPP_API_URL');
    this.apiKey = this.configService.get<string>('WHATSAPP_API_KEY');
    this.providers = providers;
    
    // Validar configuración básica
    if (!this.apiUrl) {
      this.logger.warn('WHATSAPP_API_URL no está configurada');
    }
    if (!this.apiKey) {
      this.logger.warn('WHATSAPP_API_KEY no está configurada');
    }
    
    this.logger.log(`Configuración de WhatsApp: URL ${this.apiUrl}`);
  }

  async onModuleInit() {
    try {
      // Inicializar proveedores para cada chatbot activo
      const chatbots = await this.chatbotRepository.find({
        where: { isActive: true }
      });

      for (const chatbot of chatbots) {
        await this.initializeChatbotProvider(chatbot);
      }
    } catch (error) {
      this.logger.error(`Error inicializando proveedores de WhatsApp: ${error.message}`);
    }
  }

  private async initializeChatbotProvider(chatbot: Chatbot) {
    try {
      const { whatsapp } = chatbot.settings;
      if (!whatsapp || !whatsapp.provider || !whatsapp.instanceId) {
        this.logger.warn(`Chatbot ${chatbot.name} no tiene configuración de WhatsApp`);
        return;
      }

      const provider = this.providers[whatsapp.provider];
      if (!provider) {
        this.logger.error(`Proveedor ${whatsapp.provider} no encontrado para chatbot ${chatbot.name}`);
        return;
      }

      // Registrar el proveedor para este chatbot
      this.chatbotInstances.set(chatbot.id, provider);
      this.logger.log(`Proveedor de WhatsApp inicializado para chatbot ${chatbot.name}`);

      // Configurar el webhook automáticamente si está definido
      if (whatsapp.webhookUrl) {
        try {
          await provider.updateConfig({
            instanceId: whatsapp.instanceId,
            apiUrl: whatsapp.apiUrl || this.apiUrl,
            apiKey: whatsapp.apiKey || this.apiKey,
            webhookUrl: whatsapp.webhookUrl,
            webhookEvents: whatsapp.webhookEvents || ['message', 'status'],
            webhookSecret: whatsapp.webhookSecret
          });
          this.logger.log(`Webhook configurado automáticamente para chatbot ${chatbot.name}: ${whatsapp.webhookUrl}`);
        } catch (webhookError) {
          this.logger.error(`Error configurando webhook para chatbot ${chatbot.name}: ${webhookError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error inicializando proveedor para chatbot ${chatbot.name}: ${error.message}`);
    }
  }

  async sendMessage(phoneNumber: string, message: string, chatbotId: string) {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado o inactivo`);
      }

      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      if (!chatbot.settings?.whatsapp?.instanceId) {
        throw new Error(`El chatbot ${chatbotId} no tiene configurado un ID de instancia de WhatsApp`);
      }

      // Pasar la configuración completa al proveedor
      const config = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      const response = await provider.sendMessage(
        phoneNumber, 
        message, 
        config
      );
      
      this.logger.log(`Mensaje enviado exitosamente a ${phoneNumber}`);
      return response;
    } catch (error) {
      this.logger.error(`Error enviando mensaje: ${error.message}`);
      throw error;
    }
  }

  async processIncomingMessage(message: WhatsAppMessage, chatbotId: string) {
    try {
      this.logger.log(`Procesando mensaje para chatbot ${chatbotId}:`, JSON.stringify(message, null, 2));

      // Validar que el chatbot existe y está activo
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        this.logger.warn(`Chatbot ${chatbotId} no encontrado o inactivo`);
        return { status: 'error', message: 'Chatbot no encontrado o inactivo' };
      }

      // Validar que el proveedor está configurado
      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        this.logger.warn(`No hay proveedor configurado para el chatbot ${chatbotId}`);
        return { status: 'error', message: 'Proveedor no configurado' };
      }

      // Procesar el mensaje
      const response = await this.valeryChatbotService.handleMessage(
        message.body,
        message.from,
        chatbotId
      );

      this.logger.log(`Respuesta generada para mensaje:`, JSON.stringify(response, null, 2));
      return response;
    } catch (error) {
      this.logger.error(`Error procesando mensaje entrante: ${error.message}`);
      this.logger.error('Stack trace:', error.stack);
      throw error;
    }
  }

  async getConnectionStatus(chatbotId: string) {
    try {
      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      const config = await provider.getConfig();
      return config;
    } catch (error) {
      this.logger.error(`Error obteniendo estado de conexión: ${error.message}`);
      throw error;
    }
  }

  async createInstance(chatbotId: string) {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado`);
      }

      await this.initializeChatbotProvider(chatbot);
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error creando instancia: ${error.message}`);
      throw error;
    }
  }

  async deleteInstance(chatbotId: string) {
    try {
      const provider = this.chatbotInstances.get(chatbotId);
      if (provider) {
        await provider.disconnect();
        this.chatbotInstances.delete(chatbotId);
      }
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error eliminando instancia: ${error.message}`);
      throw error;
    }
  }

  async configureWebhook(config: {
    webhookUrl: string;
    webhookEvents: string[];
    webhookSecret?: string;
  }, chatbotId: string) {
    try {
      this.logger.log(`Configurando webhook para chatbot ${chatbotId}`);
      
      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }
      
      const webhookUrl = config.webhookUrl;
      
      // Verificar que el chatbot existe
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId }
      });
      
      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado`);
      }

      // Actualizar la configuración de WhatsApp en el chatbot
      chatbot.settings.whatsapp = {
        ...chatbot.settings.whatsapp,
        webhookUrl,
        webhookEvents: config.webhookEvents || ['message', 'status'],
        webhookSecret: config.webhookSecret
      };

      await this.chatbotRepository.save(chatbot);

      // Crear el objeto de configuración para el webhook
      const webhookConfig: WhatsAppWebhookConfig = {
        url: webhookUrl,
        events: config.webhookEvents || ['message', 'status'],
        secret: config.webhookSecret
      };
      
      // Crear el objeto de configuración para el proveedor
      const providerConfig: WhatsAppConfig = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      // Actualizar la configuración del proveedor
      if (provider.configureWebhook) {
        await provider.configureWebhook(webhookConfig, providerConfig);
      } else {
        this.logger.warn(`El proveedor no soporta configuración de webhook`);
      }

      this.logger.log(`Webhook configurado para chatbot ${chatbotId}: ${webhookUrl}`);
      return { 
        status: 'success',
        webhookUrl,
        events: config.webhookEvents || ['message', 'status']
      };
    } catch (error) {
      this.logger.error(`Error configurando webhook: ${error.message}`);
      throw error;
    }
  }

  async sendImage(to: string, imageUrl: string, caption: string, chatbotId: string): Promise<WhatsAppMessage> {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado o inactivo`);
      }

      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      if (!chatbot.settings?.whatsapp?.instanceId) {
        throw new Error(`El chatbot ${chatbotId} no tiene configurado un ID de instancia de WhatsApp`);
      }

      // Pasar la configuración completa al proveedor
      const config = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      const response = await provider.sendImage(
        to, 
        imageUrl, 
        caption, 
        config
      );
      
      this.logger.log(`Imagen enviada exitosamente a ${to}`);
      return response;
    } catch (error) {
      this.logger.error(`Error enviando imagen: ${error.message}`);
      throw error;
    }
  }

  async sendDocument(to: string, documentUrl: string, caption: string, chatbotId: string): Promise<WhatsAppMessage> {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado o inactivo`);
      }

      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      if (!chatbot.settings?.whatsapp?.instanceId) {
        throw new Error(`El chatbot ${chatbotId} no tiene configurado un ID de instancia de WhatsApp`);
      }

      // Pasar la configuración completa al proveedor
      const config = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      const response = await provider.sendDocument(
        to, 
        documentUrl, 
        caption, 
        config
      );
      
      this.logger.log(`Documento enviado exitosamente a ${to}`);
      return response;
    } catch (error) {
      this.logger.error(`Error enviando documento: ${error.message}`);
      throw error;
    }
  }

  async sendAudio(to: string, audioUrl: string, chatbotId: string): Promise<WhatsAppMessage> {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado o inactivo`);
      }

      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      if (!chatbot.settings?.whatsapp?.instanceId) {
        throw new Error(`El chatbot ${chatbotId} no tiene configurado un ID de instancia de WhatsApp`);
      }

      // Pasar la configuración completa al proveedor
      const config = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      const response = await provider.sendAudio(
        to, 
        audioUrl, 
        config
      );
      
      this.logger.log(`Audio enviado exitosamente a ${to}`);
      return response;
    } catch (error) {
      this.logger.error(`Error enviando audio: ${error.message}`);
      throw error;
    }
  }

  async getQRCode(chatbotId: string): Promise<string> {
    try {
      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }
      return provider.getQRCode();
    } catch (error) {
      this.logger.error(`Error obteniendo código QR: ${error.message}`);
      throw error;
    }
  }

  async updateConfig(config: any, chatbotId: string): Promise<void> {
    const provider = this.chatbotInstances.get(chatbotId);
    if (!provider) {
      throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
    }
    await provider.updateConfig(config);
  }

  async getConfig(chatbotId: string): Promise<any> {
    const provider = this.chatbotInstances.get(chatbotId);
    if (!provider) {
      throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
    }
    return provider.getConfig();
  }

  getAvailableProviders(): string[] {
    return Object.keys(this.providers);
  }

  getActiveProvider(chatbotId: string): string | undefined {
    const provider = this.chatbotInstances.get(chatbotId);
    return provider ? Object.entries(this.providers).find(([_, p]) => p === provider)?.[0] : undefined;
  }

  async findChatbotByInstance(instanceId: string): Promise<Chatbot> {
    try {
      this.logger.log(`Buscando chatbot para instancia: ${instanceId}`);
      
      // Usando QueryBuilder para acceder a propiedades anidadas en JSON
      const chatbot = await this.chatbotRepository.createQueryBuilder('chatbot')
        .where('chatbot."isActive" = :isActive', { isActive: true })
        .andWhere("chatbot.settings->'whatsapp'->>'instanceId' = :instanceId", { instanceId })
        .getOne();
      
      if (!chatbot) {
        this.logger.warn(`No se encontró chatbot para la instancia ${instanceId}`);
        
        // Depuración adicional: listar todos los chatbots activos
        const allChatbots = await this.chatbotRepository.find({ 
          where: { isActive: true } 
        });
        
        this.logger.debug(`Chatbots activos encontrados: ${allChatbots.length}`);
        for (const bot of allChatbots) {
          this.logger.debug(`Chatbot ${bot.id}: instanceId=${bot.settings?.whatsapp?.instanceId}`);
        }
      } else {
        this.logger.log(`Chatbot encontrado para instancia ${instanceId}: ${chatbot.id} (${chatbot.name})`);
      }
      
      return chatbot;
    } catch (error) {
      this.logger.error(`Error al buscar chatbot por instancia: ${error.message}`);
      throw error;
    }
  }
  
  
  

  /**
   * Valida la firma de un webhook de WhatsApp
   * @param signature Firma recibida en el header x-whatsapp-signature
   * @param payload Cuerpo del mensaje
   * @param secret Secreto configurado para el webhook
   * @returns boolean indicando si la firma es válida
   */
  async validateWebhookSignature(
    signature: string,
    payload: any,
    secret: string
  ): Promise<boolean> {
    try {
      const hmac = crypto.createHmac('sha256', secret);
      const calculatedSignature = hmac
        .update(JSON.stringify(payload))
        .digest('hex');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(calculatedSignature)
      );
    } catch (error) {
      this.logger.error(`Error validando firma de webhook: ${error.message}`);
      return false;
    }
  }

  async sendLocation(to: string, latitude: number, longitude: number, chatbotId: string): Promise<WhatsAppMessage> {
    try {
      const chatbot = await this.chatbotRepository.findOne({
        where: { id: chatbotId, isActive: true }
      });

      if (!chatbot) {
        throw new Error(`Chatbot ${chatbotId} no encontrado o inactivo`);
      }

      const provider = this.chatbotInstances.get(chatbotId);
      if (!provider) {
        throw new Error(`No hay proveedor de WhatsApp configurado para el chatbot ${chatbotId}`);
      }

      if (!chatbot.settings?.whatsapp?.instanceId) {
        throw new Error(`El chatbot ${chatbotId} no tiene configurado un ID de instancia de WhatsApp`);
      }

      // Pasar la configuración completa al proveedor
      const config = {
        instanceId: chatbot.settings.whatsapp.instanceId,
        apiUrl: chatbot.settings.whatsapp.apiUrl || this.apiUrl,
        apiKey: chatbot.settings.whatsapp.apiKey || this.apiKey
      };

      const response = await provider.sendLocation(
        to, 
        latitude,
        longitude,
        config
      );
      
      this.logger.log(`Ubicación enviada exitosamente a ${to}`);
      return response;
    } catch (error) {
      this.logger.error(`Error enviando ubicación: ${error.message}`);
      throw error;
    }
  }
} 