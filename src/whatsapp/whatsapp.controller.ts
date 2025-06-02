/**
 * Controlador principal para manejar las interacciones con WhatsApp.
 * Este controlador gestiona los webhooks, mensajes, estados y sesiones de chat.
 * 
 * @class WhatsappController
 */
import { Controller, Post, Body, Get, Param, Delete, Logger, Query, Inject, forwardRef, UseGuards, Req, Headers, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { WhatsappService } from './whatsapp.service';
import { ChatService } from '../chat/chat.service';
import { MediaService } from '../media/media.service';
import { WhatsAppMessage } from './interfaces/whatsapp-provider.interface';
import { ValeryChatbotService } from '../valery/valery-chatbot.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chatbot } from '../admin/entities/chatbot.entity';
import { ConfigService } from '@nestjs/config';

// Decorador personalizado para excluir rutas de la autenticación
export const Public = () => SetMetadata('isPublic', true);

@ApiTags('whatsapp')
@Controller('whatsapp')
@UseGuards(JwtAuthGuard)
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(
    @Inject(forwardRef(() => WhatsappService))
    private readonly whatsappService: WhatsappService,
    private readonly chatService: ChatService,
    private readonly mediaService: MediaService,
    private valeryChatbotService: ValeryChatbotService,
    @InjectRepository(Chatbot, 'users')
    private readonly chatbotRepository: Repository<Chatbot>,
    private readonly configService: ConfigService
  ) {}

  @Post('message')
  @ApiOperation({ summary: 'Enviar mensaje de WhatsApp' })
  @ApiResponse({ status: 200, description: 'Mensaje enviado exitosamente' })
  async sendMessage(
    @Body() data: { phoneNumber: string; message: string },
    @Req() req
  ) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.sendMessage(
      data.phoneNumber,
      data.message,
      chatbotId
    );
  }

  @Post('webhook')
  @Public()
  @ApiOperation({ summary: 'Procesar mensaje entrante de WhatsApp' })
  @ApiResponse({ status: 200, description: 'Mensaje procesado exitosamente' })
  async receiveWebhook(@Body() webhookData: any, @Headers() headers: any) {
    this.logger.log('=== NUEVO MENSAJE WEBHOOK ===');
    this.logger.log('Headers completos:', JSON.stringify(headers, null, 2));
    this.logger.log('Mensaje webhook recibido:', JSON.stringify(webhookData, null, 2));

    let mappedMessage;

    // **SPECIAL LOGGING FOR AUDIO MESSAGES**
    if (webhookData?.data?.messageType === 'audioMessage' || 
        webhookData?.data?.message?.audioMessage ||
        (webhookData?.data && JSON.stringify(webhookData).includes('audio'))) {
      this.logger.log('🎵 ===== MENSAJE DE AUDIO DETECTADO =====');
      this.logger.log('🎵 Estructura completa del webhook:', JSON.stringify(webhookData, null, 2));
      
      // Verificar si viene el base64 como en n8n
      if (webhookData?.data?.message?.base64) {
        this.logger.log('🎵 ✅ BASE64 ENCONTRADO EN data.message.base64:', webhookData.data.message.base64.substring(0, 100) + '...');
      } else {
        this.logger.log('🎵 ❌ NO SE ENCONTRÓ data.message.base64');
      }
      
      // Verificar otras ubicaciones posibles
      if (webhookData?.data?.message?.audioMessage?.base64) {
        this.logger.log('🎵 ✅ BASE64 ENCONTRADO EN data.message.audioMessage.base64:', webhookData.data.message.audioMessage.base64.substring(0, 100) + '...');
      }
      
      if (webhookData?.data?.base64) {
        this.logger.log('🎵 ✅ BASE64 ENCONTRADO EN data.base64:', webhookData.data.base64.substring(0, 100) + '...');
      }
      
      this.logger.log('🎵 =====================================');
    }

    try {
      // Detectar formato de mensajes (hay diferentes formatos según el proveedor)
      if (webhookData.event === 'messages.upsert' && webhookData.instance && webhookData.data) {
        const { instance, data } = webhookData;
        
        // Determinar el tipo de mensaje
        let messageType = 'text';
        let messageBody = '';
        let metadata = {};

        if (data.message?.conversation) {
          messageType = 'text';
          messageBody = data.message.conversation;
        } else if (data.message?.audioMessage) {
          messageType = 'audio';
          messageBody = '[Audio message]';
          metadata = {
            audioUrl: data.message.audioMessage.url,
            mimetype: data.message.audioMessage.mimetype,
            fileLength: data.message.audioMessage.fileLength,
            seconds: data.message.audioMessage.seconds,
            ptt: data.message.audioMessage.ptt === true, // Asegurar que sea booleano
            mediaKey: data.message.audioMessage.mediaKey,
            // NUEVA IMPLEMENTACIÓN: Capturar base64 como en n8n
            base64Audio: data.message.base64 || data.message.audioMessage.base64 || '' // Priorizar data.message.base64
          };
        } else if (data.message?.imageMessage) {
          messageType = 'image';
          messageBody = data.message.imageMessage.caption || '';
          metadata = {
            imageUrl: data.message.imageMessage.url,
            mimetype: data.message.imageMessage.mimetype,
            fileLength: data.message.imageMessage.fileLength,
            caption: data.message.imageMessage.caption || '',
            mediaKey: data.message.imageMessage.mediaKey,
            base64Image: data.message.imageMessage.base64 || '' // Añadir soporte para imagen en base64
          };
        } else if (data.message?.videoMessage) {
          messageType = 'video';
          messageBody = data.message.videoMessage.caption || '';
        } else if (data.message?.documentMessage) {
          messageType = 'document';
          messageBody = data.message.documentMessage.fileName || 'Documento';
        }

        mappedMessage = {
          from: data.key?.remoteJid || '',
          to: instance,
          body: messageBody,
          timestamp: new Date(data.messageTimestamp * 1000 || Date.now()),
          type: messageType,
          instanceId: instance,
          messageId: data.key?.id || '',
          status: data.status || 'DELIVERY_ACK',
          metadata: metadata
        };
      } 
      // Waba SMS format
      else if (webhookData.wabaId && webhookData.phone) {
        // Determinar el tipo de mensaje (texto, audio, etc.)
        let messageType = webhookData.type || 'text';
        let messageBody = webhookData.text || webhookData.caption || '';
        
        // Metadatos para audio
        let metadata = {};
        if (messageType === 'audio') {
          metadata = {
            audioUrl: webhookData.audioUrl || webhookData.url || webhookData.media || '',
            mimetype: webhookData.mimetype || 'audio/ogg',
            fileLength: webhookData.fileLength || 0,
            seconds: webhookData.seconds || 0,
            mediaKey: webhookData.mediaKey || '',
            base64Audio: webhookData.base64 || webhookData.base64Audio || '' // Añadir soporte para audio en base64
          };
        } else if (messageType === 'image') {
          metadata = {
            imageUrl: webhookData.imageUrl || webhookData.url || webhookData.media || '',
            mimetype: webhookData.mimetype || 'image/jpeg',
            fileLength: webhookData.fileLength || 0,
            caption: webhookData.caption || '',
            mediaKey: webhookData.mediaKey || '',
            base64Image: webhookData.base64 || webhookData.base64Image || '' // Añadir soporte para imagen en base64
          };
        }
        
        mappedMessage = {
          from: webhookData.phone || '',
          to: webhookData.wabaId || '',
          body: messageBody,
          timestamp: new Date(webhookData.timestamp || Date.now()),
          type: messageType,
          instanceId: webhookData.wabaId || '',
          messageId: webhookData.id || '',
          status: webhookData.status || '',
          metadata: metadata
        };
      }
      // Generic format - direct fields
      else if (webhookData.from && webhookData.body && webhookData.instanceId) {
        // Si ya viene en formato estándar, simplemente mapeamos
        mappedMessage = {
          from: webhookData.from,
          to: webhookData.to || 'unknown',
          body: webhookData.body,
          timestamp: webhookData.timestamp || new Date(),
          type: webhookData.type || 'text',
          instanceId: webhookData.instanceId,
          messageId: webhookData.messageId || 'unknown',
          status: webhookData.status || 'DELIVERY_ACK',
          metadata: webhookData.metadata || {}
        };
      }
      // Direct message object
      else if (webhookData.message && webhookData.message.from) {
        // Si la estructura incluye un objeto message
        mappedMessage = {
          from: webhookData.message.from,
          to: webhookData.message.to || 'unknown',
          body: webhookData.message.body || webhookData.message.text || '',
          timestamp: webhookData.message.timestamp || new Date(),
          type: webhookData.message.type || 'text',
          instanceId: webhookData.message.instanceId || webhookData.instanceId || '',
          messageId: webhookData.message.id || 'unknown',
          status: webhookData.message.status || 'DELIVERY_ACK',
          metadata: webhookData.message.metadata || {}
        };
      }
      // Try to extract from data field
      else if (webhookData.data) {
        const data = webhookData.data;
        
        // Determinar el tipo de mensaje
        let messageType = data.type || 'text';
        
        // Metadatos para audio
        let metadata = data.metadata || {};
        if (messageType === 'audio') {
          metadata = {
            ...metadata,
            audioUrl: data.audioUrl || data.url || data.media || '',
            mimetype: data.mimetype || 'audio/ogg',
            fileLength: data.fileLength || 0,
            seconds: data.seconds || 0,
            mediaKey: data.mediaKey || '',
            base64Audio: data.base64 || data.base64Audio || '' // Añadir soporte para audio en base64
          };
        } else if (messageType === 'image') {
          metadata = {
            ...metadata,
            imageUrl: data.imageUrl || data.url || data.media || '',
            mimetype: data.mimetype || 'image/jpeg',
            fileLength: data.fileLength || 0,
            caption: data.caption || '',
            mediaKey: data.mediaKey || '',
            base64Image: data.base64 || data.base64Image || '' // Añadir soporte para imagen en base64
          };
        }
        
        mappedMessage = {
          from: data.from || data.sender || data.phone || data.wa_id || 
                (data.key?.remoteJid) || '',
          to: data.to || data.recipient || '',
          body: data.body || data.text || data.content || data.message || 
                (data.message?.conversation) || '',
          timestamp: new Date(data.timestamp || Date.now()),
          type: messageType,
          instanceId: webhookData.instance || data.instance || '',
          messageId: data.id || data.messageId || 'unknown',
          status: data.status || 'DELIVERY_ACK',
          metadata: metadata
        };
      }
      
      if (!mappedMessage || !mappedMessage.from) {
        this.logger.warn('Formato de webhook no reconocido o datos incompletos');
        this.logger.warn('Se requieren al menos los campos: from, instanceId');
        return { success: true, message: 'Formato de webhook no reconocido' };
      }
      
      // Para mensajes de audio, el cuerpo puede estar vacío
      if (!mappedMessage.body && mappedMessage.type !== 'audio') {
        this.logger.warn('Mensaje sin cuerpo de texto');
        mappedMessage.body = ''; // Establecer un valor por defecto
      }
      
      // Si no hay instanceId, intentar extraerlo del número de teléfono 
      if (!mappedMessage.instanceId && mappedMessage.to) {
        mappedMessage.instanceId = mappedMessage.to;
      }
      
      // Si aún no hay instanceId, buscar en la configuración
      if (!mappedMessage.instanceId) {
        mappedMessage.instanceId = this.configService.get<string>('WHATSAPP_DEFAULT_INSTANCE');
        this.logger.log(`Usando instancia por defecto: ${mappedMessage.instanceId}`);
      }
      
      this.logger.log('Mensaje mapeado:', JSON.stringify(mappedMessage, null, 2));

      // Buscar el chatbot asociado a esta instancia
      this.logger.log(`Buscando chatbot para instancia: ${mappedMessage.instanceId}`);
      
      // Buscar en la base de datos el chatbot con esa instancia en las configuraciones
      const chatbot = await this.chatbotRepository.findOne({
        where: {
          isActive: true
        }
      });

      if (!chatbot) {
        this.logger.warn(`No se encontró chatbot activo, buscando chatbot con ID por defecto`);
        const defaultChatbotId = this.configService.get<string>('DEFAULT_CHATBOT_ID');
        
        if (!defaultChatbotId) {
          this.logger.warn('No hay configuración de chatbot por defecto');
          return { success: false, message: 'Chatbot no encontrado' };
        }
        
        // Buscar el chatbot por ID
        const defaultChatbot = await this.chatbotRepository.findOne({
          where: { id: defaultChatbotId, isActive: true }
        });
        
        if (!defaultChatbot) {
          this.logger.warn(`No se encontró chatbot por defecto con ID ${defaultChatbotId}`);
          return { success: false, message: 'Chatbot por defecto no encontrado' };
        }
        
        this.logger.log(`Usando chatbot por defecto: ${defaultChatbot.id} (${defaultChatbot.name})`);
        
        // Si es un mensaje de audio, procesarlo primero con el servicio de media
        if (mappedMessage.type === 'audio' && (mappedMessage.metadata?.audioUrl || mappedMessage.metadata?.base64Audio)) {
          this.logger.log('Procesando mensaje de audio...');
          try {
            const transcription = await this.mediaService.transcribeAudio(
              mappedMessage.metadata.audioUrl,
              mappedMessage.metadata.mediaKey,
              mappedMessage.metadata.base64Audio, // Pasar el audio en base64 si existe
              mappedMessage.metadata,  // Pasando todos los metadatos
              mappedMessage.messageId, // Pasar messageId
              mappedMessage.instanceId // Pasar instanceId
            );
            this.logger.log(`Audio transcrito: ${transcription}`);
            
            // Si la transcripción contiene un mensaje de error, mostrar un mensaje amigable
            if (transcription.toLowerCase().includes('no se pudo transcribir') || 
                transcription.toLowerCase().includes('error')) {
              mappedMessage.body = "Lo siento, no pude entender el audio. ¿Podrías intentar enviar un mensaje de texto o un audio más claro?";
            } else {
              mappedMessage.body = transcription;
            }
          } catch (error) {
            this.logger.error(`Error al transcribir audio: ${error.message}`);
            mappedMessage.body = "Lo siento, no pude procesar tu mensaje de voz. ¿Podrías enviar un mensaje de texto?";
          }
        }
        // Si es un mensaje de imagen, analizarla
        else if (mappedMessage.type === 'image' && (mappedMessage.metadata?.imageUrl || mappedMessage.metadata?.base64Image)) {
          this.logger.log('Procesando imagen...');
          try {
            const imageAnalysis = await this.mediaService.analyzeImage(
              mappedMessage.metadata.imageUrl,
              mappedMessage.metadata.mediaKey,
              mappedMessage.metadata,
              mappedMessage.metadata.base64Image, // Pasar el base64 directamente
              mappedMessage.messageId, // Pasar messageId para Evolution API
              mappedMessage.instanceId // Pasar instanceId para Evolution API
            );
            
            this.logger.log(`Imagen analizada: ${JSON.stringify(imageAnalysis)}`);
            
            // Construir respuesta basada en el análisis
            let responseBody = '';
            
            // Si hay un caption original, usarlo como contexto
            if (mappedMessage.metadata.caption && mappedMessage.metadata.caption.trim()) {
              responseBody = `Sobre la imagen "${mappedMessage.metadata.caption}":\n\n`;
            }
            
            // Incluir descripción del contenido
            if (imageAnalysis.description) {
              responseBody += imageAnalysis.description + '\n\n';
            }
            
            // Si hay texto en la imagen, incluirlo
            if (imageAnalysis.textContent) {
              responseBody += `Texto detectado en la imagen:\n${imageAnalysis.textContent}`;
            } else if (responseBody) {
              responseBody += "No se detectó texto en la imagen.";
            }
            
            // Si no pudimos obtener ni descripción ni texto
            if (!responseBody) {
              responseBody = "He recibido tu imagen, pero no pude analizarla correctamente. ¿Podrías intentar enviarla nuevamente?";
            }
            
            mappedMessage.body = responseBody;
          } catch (error) {
            this.logger.error(`Error al analizar imagen: ${error.message}`);
            mappedMessage.body = "Lo siento, no pude analizar la imagen que enviaste. Por favor, intenta enviar la imagen nuevamente.";
          }
        }
        
        // Procesar el mensaje con el servicio de chat
        const response = await this.valeryChatbotService.handleMessage(
          mappedMessage.body,
          mappedMessage.from,
          defaultChatbot.id
        );
        
        this.logger.log('Respuesta generada para mensaje:', response);
        
        // ENVIAR LA RESPUESTA DE VUELTA AL USUARIO PARA EL CHATBOT POR DEFECTO
        try {
          await this.whatsappService.sendMessage(
            mappedMessage.from,
            response,
            defaultChatbot.id
          );
          this.logger.log(`✅ Respuesta enviada exitosamente a ${mappedMessage.from} (chatbot por defecto)`);
        } catch (sendError) {
          this.logger.error(`❌ Error enviando respuesta (chatbot por defecto): ${sendError.message}`);
        }
        
        return { success: true, response };
      }

      this.logger.log(`Chatbot encontrado: ${chatbot.id} (${chatbot.name})`);
      this.logger.log(`Mensaje recibido para chatbot ${chatbot.id}: ${JSON.stringify(mappedMessage)}`);

      // Si es un mensaje de audio, procesarlo primero
      if (mappedMessage.type === 'audio' && (mappedMessage.metadata?.audioUrl || mappedMessage.metadata?.base64Audio)) {
        this.logger.log('Procesando mensaje de audio...');
        try {
          const transcription = await this.mediaService.transcribeAudio(
            mappedMessage.metadata.audioUrl,
            mappedMessage.metadata.mediaKey,
            mappedMessage.metadata.base64Audio, // Pasar el audio en base64 si existe
            mappedMessage.metadata,  // Pasando todos los metadatos
            mappedMessage.messageId, // Pasar messageId
            mappedMessage.instanceId // Pasar instanceId
          );
          this.logger.log(`Audio transcrito: ${transcription}`);
          
          // Si la transcripción contiene un mensaje de error, mostrar un mensaje amigable
          if (transcription.toLowerCase().includes('no se pudo transcribir') || 
              transcription.toLowerCase().includes('error')) {
            mappedMessage.body = "Lo siento, no pude entender el audio. ¿Podrías intentar enviar un mensaje de texto o un audio más claro?";
          } else {
            mappedMessage.body = transcription;
          }
        } catch (error) {
          this.logger.error(`Error al transcribir audio: ${error.message}`);
          mappedMessage.body = "Lo siento, no pude procesar tu mensaje de voz. ¿Podrías enviar un mensaje de texto?";
        }
      }
      // Si es un mensaje de imagen, analizarla
      else if (mappedMessage.type === 'image' && (mappedMessage.metadata?.imageUrl || mappedMessage.metadata?.base64Image)) {
        this.logger.log('Procesando imagen...');
        try {
          const imageAnalysis = await this.mediaService.analyzeImage(
            mappedMessage.metadata.imageUrl,
            mappedMessage.metadata.mediaKey,
            mappedMessage.metadata,
            mappedMessage.metadata.base64Image, // Pasar el base64 directamente
            mappedMessage.messageId, // Pasar messageId para Evolution API
            mappedMessage.instanceId // Pasar instanceId para Evolution API
          );
          
          this.logger.log(`Imagen analizada: ${JSON.stringify(imageAnalysis)}`);
          
          // Construir respuesta basada en el análisis
          let responseBody = '';
          
          // Si hay un caption original, usarlo como contexto
          if (mappedMessage.metadata.caption && mappedMessage.metadata.caption.trim()) {
            responseBody = `Sobre la imagen "${mappedMessage.metadata.caption}":\n\n`;
          }
          
          // Incluir descripción del contenido
          if (imageAnalysis.description) {
            responseBody += imageAnalysis.description + '\n\n';
          }
          
          // Si hay texto en la imagen, incluirlo
          if (imageAnalysis.textContent) {
            responseBody += `Texto detectado en la imagen:\n${imageAnalysis.textContent}`;
          } else if (responseBody) {
            responseBody += "No se detectó texto en la imagen.";
          }
          
          // Si no pudimos obtener ni descripción ni texto
          if (!responseBody) {
            responseBody = "He recibido tu imagen, pero no pude analizarla correctamente. ¿Podrías intentar enviarla nuevamente?";
          }
          
          mappedMessage.body = responseBody;
        } catch (error) {
          this.logger.error(`Error al analizar imagen: ${error.message}`);
          mappedMessage.body = "Lo siento, no pude analizar la imagen que enviaste. Por favor, intenta enviar la imagen nuevamente.";
        }
      }
      
      // Procesar el mensaje con el servicio de chat
      this.logger.log(`Procesando mensaje para chatbot ${chatbot.id}: ${mappedMessage.body}`);
      
      // Si el chatbot es de tipo valery, usar el servicio especial
      if (chatbot.settings?.type === 'valery') {
        const response = await this.valeryChatbotService.handleMessage(
          mappedMessage.body,
          mappedMessage.from,
          chatbot.id
        );
        this.logger.log('Respuesta generada para mensaje:', response);
        
        // ENVIAR LA RESPUESTA DE VUELTA AL USUARIO
        try {
          await this.whatsappService.sendMessage(
            mappedMessage.from,
            response,
            chatbot.id
          );
          this.logger.log(`✅ Respuesta enviada exitosamente a ${mappedMessage.from}`);
        } catch (sendError) {
          this.logger.error(`❌ Error enviando respuesta: ${sendError.message}`);
        }
        
        return { success: true, response };
      }

      // Para otros tipos de chatbot, usar el flujo normal
      const response = await this.valeryChatbotService.handleMessage(
        mappedMessage.body,
        mappedMessage.from,
        chatbot.id
      );
      
      // ENVIAR LA RESPUESTA DE VUELTA AL USUARIO TAMBIÉN PARA OTROS TIPOS
      try {
        await this.whatsappService.sendMessage(
          mappedMessage.from,
          response,
          chatbot.id
        );
        this.logger.log(`✅ Respuesta enviada exitosamente a ${mappedMessage.from}`);
      } catch (sendError) {
        this.logger.error(`❌ Error enviando respuesta: ${sendError.message}`);
      }
      
      return { success: true, response };
    } catch (error) {
      this.logger.error(`Error procesando webhook: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  private mapMessageType(type: string): WhatsAppMessage['type'] {
    switch (type.toLowerCase()) {
      case 'text':
        return 'text';
      case 'image':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'audio';
      case 'document':
        return 'document';
      case 'location':
        return 'location';
      case 'system':
        return 'system';
      default:
        return 'text';
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Obtener estado de conexión' })
  @ApiResponse({ status: 200, description: 'Estado obtenido exitosamente' })
  async getConnectionStatus(@Req() req) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.getConnectionStatus(chatbotId);
  }

  @Post('instance')
  @ApiOperation({ summary: 'Crear nueva instancia' })
  @ApiResponse({ status: 201, description: 'Instancia creada exitosamente' })
  async createInstance(@Req() req) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.createInstance(chatbotId);
  }

  @Delete('instance')
  @ApiOperation({ summary: 'Eliminar instancia' })
  @ApiResponse({ status: 200, description: 'Instancia eliminada exitosamente' })
  async deleteInstance(@Req() req) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.deleteInstance(chatbotId);
  }

  /**
   * Configura el webhook para recibir notificaciones de WhatsApp.
   * 
   * @param {string} webhookUrl - URL donde se recibirán las notificaciones
   * @returns {Promise<any>} Resultado de la configuración
   */
  @Post('webhook/configure')
  @ApiOperation({ summary: 'Configurar webhook' })
  @ApiResponse({ status: 200, description: 'Webhook configurado exitosamente' })
  async configureWebhook(
    @Body() data: { 
      url: string;
      events?: string[];
      secret?: string;
    },
    @Req() req
  ) {
    const chatbotId = req.user.chatbotId;
    try {
      const config = {
        webhookUrl: data.url,
        webhookEvents: data.events || ['message', 'status'],
        webhookSecret: data.secret
      };

      const result = await this.whatsappService.configureWebhook(config, chatbotId);
      this.logger.log(`Webhook configurado para chatbot ${chatbotId}: ${data.url}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al configurar webhook: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtiene el historial de chat para un número de teléfono específico.
   * 
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @param {number} limit - Límite de mensajes a retornar (default: 10)
   * @returns {Promise<ChatMessage[]>} Historial de mensajes
   */
  @Get('history')
  @ApiOperation({ summary: 'Obtener historial de chat' })
  @ApiResponse({ status: 200, description: 'Historial obtenido exitosamente' })
  async getChatHistory(
    @Query('phoneNumber') phoneNumber: string,
    @Query('limit') limit: number = 10
  ) {
    try {
      const history = await this.chatService.getChatHistory(phoneNumber);
      return history;
    } catch (error) {
      this.logger.error(`Error al obtener historial: ${error.message}`);
      throw error;
    }
  }

  /**
   * Finaliza una sesión de chat activa.
   * 
   * @param {string} phoneNumber - Número de teléfono del usuario
   * @returns {Promise<{status: string}>} Estado de la operación
   */
  @Post('end-session')
  @ApiOperation({ summary: 'Finalizar sesión de chat' })
  @ApiResponse({ status: 200, description: 'Sesión finalizada exitosamente' })
  async endChatSession(@Body('phoneNumber') phoneNumber: string) {
    try {
      await this.chatService.endChatSession(phoneNumber);
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error al finalizar sesión: ${error.message}`);
      throw error;
    }
  }

  @Post('status')
  @ApiOperation({ summary: 'Procesar actualización de estado' })
  @ApiResponse({ status: 200, description: 'Estado procesado exitosamente' })
  async processMessageStatus(@Body() data: { messageId: string; status: string }) {
    this.logger.log(`Actualización de estado para mensaje ${data.messageId}: ${data.status}`);
    try {
      // Aquí puedes implementar la lógica para manejar las actualizaciones de estado
      // Por ejemplo, actualizar el estado del mensaje en la base de datos
      return { status: 'success' };
    } catch (error) {
      this.logger.error(`Error al procesar actualización de estado: ${error.message}`);
      throw error;
    }
  }

  @Post('image')
  @ApiOperation({ summary: 'Envía una imagen por WhatsApp' })
  @ApiResponse({ status: 200, description: 'Imagen enviada correctamente' })
  async sendImage(
    @Body() data: { to: string; imageUrl: string; caption: string },
    @Req() req
  ) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.sendImage(
      data.to,
      data.imageUrl,
      data.caption,
      chatbotId
    );
  }

  @Post('document')
  @ApiOperation({ summary: 'Envía un documento por WhatsApp' })
  @ApiResponse({ status: 200, description: 'Documento enviado correctamente' })
  async sendDocument(
    @Body() data: { to: string; documentUrl: string; filename: string },
    @Req() req
  ) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.sendDocument(
      data.to,
      data.documentUrl,
      data.filename,
      chatbotId
    );
  }

  @Post(':chatbotId/location')
  @ApiOperation({ summary: 'Enviar ubicación por WhatsApp' })
  @ApiParam({ name: 'chatbotId', description: 'ID del chatbot' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Número de teléfono del destinatario' },
        latitude: { type: 'number', description: 'Latitud de la ubicación' },
        longitude: { type: 'number', description: 'Longitud de la ubicación' }
      },
      required: ['to', 'latitude', 'longitude']
    }
  })
  async sendLocation(
    @Param('chatbotId') chatbotId: string,
    @Body('to') to: string,
    @Body('latitude') latitude: number,
    @Body('longitude') longitude: number
  ) {
    return await this.whatsappService.sendLocation(to, latitude, longitude, chatbotId);
  }

  @Get('qrcode')
  @ApiOperation({ summary: 'Obtiene el código QR para conectar WhatsApp' })
  @ApiResponse({ status: 200, description: 'Código QR generado' })
  async getQRCode(@Req() req) {
    const chatbotId = req.user.chatbotId;
    return await this.whatsappService.getQRCode(chatbotId);
  }

  @Get('providers')
  @ApiOperation({ summary: 'Obtiene los proveedores de WhatsApp disponibles' })
  @ApiResponse({ status: 200, description: 'Lista de proveedores' })
  getAvailableProviders() {
    return this.whatsappService.getAvailableProviders();
  }

  @Get('provider')
  @ApiOperation({ summary: 'Obtiene el proveedor activo de WhatsApp' })
  @ApiResponse({ status: 200, description: 'Proveedor activo' })
  getActiveProvider(@Req() req) {
    const chatbotId = req.user.chatbotId;
    return this.whatsappService.getActiveProvider(chatbotId);
  }
} 