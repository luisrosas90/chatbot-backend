/**
 * Servicio para gestionar plantillas de mensajes.
 * Permite crear, buscar y renderizar plantillas con variables dinámicas.
 * 
 * @class TemplateService
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageTemplate, TemplateType, TemplateStatus } from '../entities/message-template.entity';

export interface TemplateVariable {
  [key: string]: string | number | Date | boolean;
}

export interface TemplateContext {
  isAuthenticated?: boolean;
  context?: string;
  userType?: string;
  language?: string;
  hasProducts?: boolean;
  errorType?: string;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    @InjectRepository(MessageTemplate, 'users')
    private templateRepository: Repository<MessageTemplate>
  ) {}

  /**
   * Crear una nueva plantilla de mensaje
   */
  async createTemplate(templateData: Partial<MessageTemplate>): Promise<MessageTemplate> {
    try {
      const template = this.templateRepository.create(templateData);
      const savedTemplate = await this.templateRepository.save(template);
      
      this.logger.log(`Plantilla creada: ${savedTemplate.name} (${savedTemplate.id})`);
      return savedTemplate;
    } catch (error) {
      this.logger.error(`Error creando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener plantillas por chatbot
   */
  async getTemplatesByChatbot(chatbotId: string, status?: TemplateStatus): Promise<MessageTemplate[]> {
    try {
      const whereCondition: any = { chatbotId };
      if (status) {
        whereCondition.status = status;
      }

      return await this.templateRepository.find({
        where: whereCondition,
        order: { priority: 'DESC', createdAt: 'DESC' }
      });
    } catch (error) {
      this.logger.error(`Error obteniendo plantillas: ${error.message}`);
      throw error;
    }
  }

  /**
   * Buscar plantilla automáticamente según el contexto
   */
  async findTemplateByContext(
    chatbotId: string, 
    type: TemplateType, 
    context?: TemplateContext
  ): Promise<MessageTemplate | null> {
    try {
      const templates = await this.templateRepository.find({
        where: {
          chatbotId,
          type,
          status: TemplateStatus.ACTIVE
        },
        order: { priority: 'DESC' }
      });

      if (!templates.length) {
        return null;
      }

      // Si no hay contexto, devolver la primera (mayor prioridad)
      if (!context) {
        return templates[0];
      }

      // Buscar plantilla que coincida con el contexto
      for (const template of templates) {
        if (this.matchesContext(template, context)) {
          return template;
        }
      }

      // Si no hay coincidencia exacta, devolver la de mayor prioridad
      return templates[0];
    } catch (error) {
      this.logger.error(`Error buscando plantilla por contexto: ${error.message}`);
      return null;
    }
  }

  /**
   * Renderizar plantilla con variables
   */
  async renderTemplate(
    templateId: string, 
    variables: TemplateVariable = {}
  ): Promise<string> {
    try {
      const template = await this.templateRepository.findOne({
        where: { id: templateId }
      });

      if (!template) {
        throw new NotFoundException(`Plantilla ${templateId} no encontrada`);
      }

      return this.processTemplateContent(template.content, variables);
    } catch (error) {
      this.logger.error(`Error renderizando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Renderizar plantilla directamente por tipo y contexto
   */
  async renderTemplateByType(
    chatbotId: string,
    type: TemplateType,
    variables: TemplateVariable = {},
    context?: TemplateContext
  ): Promise<string> {
    try {
      const template = await this.findTemplateByContext(chatbotId, type, context);
      
      if (!template) {
        // Devolver mensaje por defecto si no hay plantilla
        return this.getDefaultMessage(type, variables);
      }

      return this.processTemplateContent(template.content, variables);
    } catch (error) {
      this.logger.error(`Error renderizando plantilla por tipo: ${error.message}`);
      return this.getDefaultMessage(type, variables);
    }
  }

  /**
   * Procesar contenido de plantilla reemplazando variables
   */
  private processTemplateContent(content: string, variables: TemplateVariable): string {
    let processedContent = content;

    // Agregar variables predeterminadas
    const defaultVariables = {
      fecha: new Date().toLocaleDateString('es-ES'),
      hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
      año: new Date().getFullYear(),
      ...variables
    };

    // Reemplazar variables en formato {{variable}}
    Object.entries(defaultVariables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      processedContent = processedContent.replace(regex, String(value));
    });

    // Limpiar variables no reemplazadas
    processedContent = processedContent.replace(/{{[^}]+}}/g, '');

    return processedContent.trim();
  }

  /**
   * Verificar si una plantilla coincide con el contexto
   */
  private matchesContext(template: MessageTemplate, context: TemplateContext): boolean {
    if (!template.conditions) {
      return true;
    }

    const conditions = template.conditions;

    // Verificar cada condición
    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== undefined && context[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtener mensaje por defecto cuando no hay plantilla
   */
  private getDefaultMessage(type: TemplateType, variables: TemplateVariable): string {
    const defaults = {
      [TemplateType.WELCOME]: '¡Hola! ¿En qué puedo ayudarte hoy?',
      [TemplateType.FAREWELL]: '¡Hasta luego! Que tengas un buen día.',
      [TemplateType.ERROR]: 'Lo siento, ocurrió un error. Por favor, intenta nuevamente.',
      [TemplateType.NO_RESPONSE]: 'No estoy seguro de cómo ayudarte con eso. ¿Podrías ser más específico?',
      [TemplateType.PRODUCT_FOUND]: `Encontramos ${variables.cantidad || 'varios'} productos.`,
      [TemplateType.PRODUCT_NOT_FOUND]: `No encontramos productos relacionados con "${variables.busqueda || 'tu búsqueda'}".`,
      [TemplateType.AUTHENTICATION_REQUIRED]: 'Por favor, identifícate para continuar.',
      [TemplateType.AUTHENTICATION_SUCCESS]: `¡Bienvenido ${variables.nombre || ''}!`,
      [TemplateType.AUTHENTICATION_FAILED]: 'No pudimos verificar tu identidad. Intenta nuevamente.',
      [TemplateType.MENU]: '¿Cómo puedo ayudarte?\n\n1. Productos\n2. Ayuda',
      [TemplateType.HELP]: 'Aquí tienes información de ayuda.',
      [TemplateType.CUSTOM]: 'Mensaje personalizado.'
    };

    return defaults[type] || 'Mensaje no disponible.';
  }

  /**
   * Actualizar plantilla
   */
  async updateTemplate(id: string, updateData: Partial<MessageTemplate>): Promise<MessageTemplate> {
    try {
      const template = await this.templateRepository.findOne({ where: { id } });
      
      if (!template) {
        throw new NotFoundException(`Plantilla ${id} no encontrada`);
      }

      Object.assign(template, updateData);
      const updatedTemplate = await this.templateRepository.save(template);
      
      this.logger.log(`Plantilla actualizada: ${updatedTemplate.name} (${updatedTemplate.id})`);
      return updatedTemplate;
    } catch (error) {
      this.logger.error(`Error actualizando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Eliminar plantilla
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      const result = await this.templateRepository.delete(id);
      
      if (result.affected === 0) {
        throw new NotFoundException(`Plantilla ${id} no encontrada`);
      }
      
      this.logger.log(`Plantilla eliminada: ${id}`);
    } catch (error) {
      this.logger.error(`Error eliminando plantilla: ${error.message}`);
      throw error;
    }
  }

  /**
   * Crear plantillas predeterminadas para un chatbot
   */
  async createDefaultTemplates(chatbotId: string): Promise<MessageTemplate[]> {
    try {
      const defaultTemplates = [
        {
          name: 'Mensaje de Bienvenida',
          type: TemplateType.WELCOME,
          content: '👋 ¡Hola {{nombre}}! Bienvenido a nuestro servicio de atención al cliente. ¿En qué puedo ayudarte hoy?',
          variables: ['nombre'],
          description: 'Mensaje de bienvenida para nuevos usuarios',
          quickReplies: ['Ver productos', 'Hablar con un agente', 'Ayuda']
        },
        {
          name: 'Menú Principal',
          type: TemplateType.MENU,
          content: '¿Cómo puedo ayudarte?\n\n1️⃣ Consultar productos\n2️⃣ Ver mi saldo\n3️⃣ Historial de facturas\n4️⃣ Hacer un pedido\n\nEscribe el número de la opción que deseas.',
          variables: [],
          description: 'Menú principal de opciones'
        },
        {
          name: 'Productos Encontrados',
          type: TemplateType.PRODUCT_FOUND,
          content: 'Encontramos {{cantidad}} productos relacionados con "{{busqueda}}":\n\n{{productos}}\n\n¿Te interesa alguno en particular?',
          variables: ['cantidad', 'busqueda', 'productos'],
          description: 'Mostrar resultados de búsqueda de productos'
        },
        {
          name: 'Productos No Encontrados',
          type: TemplateType.PRODUCT_NOT_FOUND,
          content: 'Lo siento, no encontramos productos que coincidan con "{{busqueda}}". ¿Quieres intentar con otro término?',
          variables: ['busqueda'],
          description: 'Mensaje cuando no se encuentran productos'
        },
        {
          name: 'Error General',
          type: TemplateType.ERROR,
          content: '😔 Lo siento, ocurrió un error al procesar tu solicitud. Por favor, intenta nuevamente en unos momentos.',
          variables: [],
          description: 'Mensaje de error general'
        }
      ];

      const createdTemplates = [];
      for (const templateData of defaultTemplates) {
        const template = await this.createTemplate({
          ...templateData,
          chatbotId,
          status: TemplateStatus.ACTIVE,
          priority: 0
        });
        createdTemplates.push(template);
      }

      this.logger.log(`Plantillas predeterminadas creadas para chatbot ${chatbotId}`);
      return createdTemplates;
    } catch (error) {
      this.logger.error(`Error creando plantillas predeterminadas: ${error.message}`);
      throw error;
    }
  }
} 