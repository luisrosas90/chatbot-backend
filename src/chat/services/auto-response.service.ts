/**
 * Servicio para manejar respuestas automáticas inteligentes.
 * Analiza mensajes entrantes y genera respuestas basadas en:
 * - Patrones de texto
 * - Palabras clave
 * - Contexto del usuario
 * - Plantillas predefinidas
 * 
 * @class AutoResponseService
 */
import { Injectable, Logger } from '@nestjs/common';
import { TemplateService, TemplateVariable, TemplateContext } from './template.service';
import { TemplateType } from '../entities/message-template.entity';

export interface MessageAnalysis {
  intent: string;
  confidence: number;
  entities: { [key: string]: string };
  keywords: string[];
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface AutoResponseRule {
  id: string;
  name: string;
  patterns: string[];
  keywords: string[];
  templateType: TemplateType;
  variables?: TemplateVariable;
  conditions?: TemplateContext;
  priority: number;
  isActive: boolean;
}

@Injectable()
export class AutoResponseService {
  private readonly logger = new Logger(AutoResponseService.name);

  // Reglas predefinidas para respuestas automáticas
  private readonly defaultRules: AutoResponseRule[] = [
    {
      id: 'greeting',
      name: 'Saludo',
      patterns: ['^(hola|buenos días|buenas tardes|buenas noches|hey|hi)'],
      keywords: ['hola', 'buenos', 'días', 'tardes', 'noches', 'saludos'],
      templateType: TemplateType.WELCOME,
      priority: 10,
      isActive: true
    },
    {
      id: 'farewell',
      name: 'Despedida',
      patterns: ['^(adiós|hasta luego|nos vemos|chao|bye)'],
      keywords: ['adiós', 'hasta', 'luego', 'vemos', 'chao', 'bye'],
      templateType: TemplateType.FAREWELL,
      priority: 10,
      isActive: true
    },
    {
      id: 'help',
      name: 'Solicitud de ayuda',
      patterns: ['(ayuda|help|asistencia|soporte)'],
      keywords: ['ayuda', 'help', 'asistencia', 'soporte', 'problema'],
      templateType: TemplateType.HELP,
      priority: 8,
      isActive: true
    },
    {
      id: 'menu',
      name: 'Solicitud de menú',
      patterns: ['(menú|menu|opciones|qué puedes hacer)'],
      keywords: ['menú', 'menu', 'opciones', 'puedes', 'hacer'],
      templateType: TemplateType.MENU,
      priority: 9,
      isActive: true
    },
    {
      id: 'product_search',
      name: 'Búsqueda de productos',
      patterns: ['(buscar|producto|artículo|precio|disponible|stock)'],
      keywords: ['buscar', 'producto', 'artículo', 'precio', 'disponible', 'stock', 'tienes'],
      templateType: TemplateType.PRODUCT_FOUND,
      priority: 7,
      isActive: true
    }
  ];

  constructor(
    private templateService: TemplateService
  ) {}

  /**
   * Analizar mensaje y generar respuesta automática
   */
  async analyzeAndRespond(
    message: string,
    chatbotId: string,
    context?: TemplateContext
  ): Promise<string | null> {
    try {
      this.logger.debug(`Analizando mensaje: "${message}"`);

      // Analizar el mensaje
      const analysis = this.analyzeMessage(message);
      this.logger.debug(`Análisis del mensaje:`, analysis);

      // Buscar regla que coincida
      const matchingRule = this.findMatchingRule(message, analysis, context);
      
      if (!matchingRule) {
        this.logger.debug('No se encontró regla coincidente');
        return null;
      }

      this.logger.debug(`Regla coincidente: ${matchingRule.name}`);

      // Extraer variables del mensaje
      const variables = this.extractVariables(message, analysis, matchingRule);

      // Generar respuesta usando plantillas
      const response = await this.templateService.renderTemplateByType(
        chatbotId,
        matchingRule.templateType,
        variables,
        { ...context, ...matchingRule.conditions }
      );

      this.logger.log(`Respuesta automática generada: "${response}"`);
      return response;

    } catch (error) {
      this.logger.error(`Error en respuesta automática: ${error.message}`);
      return null;
    }
  }

  /**
   * Analizar mensaje para extraer intención y entidades
   */
  private analyzeMessage(message: string): MessageAnalysis {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Detectar intención básica
    let intent = 'unknown';
    let confidence = 0;

    // Patrones de intención
    const intentPatterns = {
      greeting: /^(hola|buenos|hey|hi)/,
      farewell: /^(adiós|hasta|chao|bye)/,
      question: /\?$/,
      search: /(buscar|busco|quiero|necesito|tienes)/,
      help: /(ayuda|help|asistencia)/,
      menu: /(menú|menu|opciones)/
    };

    for (const [intentName, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(normalizedMessage)) {
        intent = intentName;
        confidence = 0.8;
        break;
      }
    }

    // Extraer entidades (números, productos, etc.)
    const entities: { [key: string]: string } = {};
    
    // Buscar números (posibles precios, cantidades, cédulas)
    const numbers = normalizedMessage.match(/\d+/g);
    if (numbers) {
      entities.numbers = numbers.join(',');
    }

    // Buscar palabras clave de productos
    const productKeywords = ['harina', 'pan', 'aceite', 'arroz', 'azúcar', 'leche'];
    const foundProducts = productKeywords.filter(keyword => 
      normalizedMessage.includes(keyword)
    );
    if (foundProducts.length > 0) {
      entities.products = foundProducts.join(',');
    }

    // Extraer palabras clave
    const keywords = normalizedMessage
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5); // Limitar a 5 palabras clave

    // Análisis de sentimiento básico
    const positiveWords = ['bien', 'bueno', 'excelente', 'perfecto', 'gracias'];
    const negativeWords = ['mal', 'malo', 'problema', 'error', 'no funciona'];
    
    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveWords.some(word => normalizedMessage.includes(word))) {
      sentiment = 'positive';
    } else if (negativeWords.some(word => normalizedMessage.includes(word))) {
      sentiment = 'negative';
    }

    return {
      intent,
      confidence,
      entities,
      keywords,
      sentiment
    };
  }

  /**
   * Buscar regla que coincida con el mensaje
   */
  private findMatchingRule(
    message: string,
    analysis: MessageAnalysis,
    context?: TemplateContext
  ): AutoResponseRule | null {
    const normalizedMessage = message.toLowerCase();

    // Ordenar reglas por prioridad
    const sortedRules = [...this.defaultRules]
      .filter(rule => rule.isActive)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      let score = 0;

      // Verificar patrones
      for (const pattern of rule.patterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(normalizedMessage)) {
          score += 10;
          break;
        }
      }

      // Verificar palabras clave
      const keywordMatches = rule.keywords.filter(keyword =>
        normalizedMessage.includes(keyword.toLowerCase())
      );
      score += keywordMatches.length * 2;

      // Verificar contexto si está definido
      if (rule.conditions && context) {
        const contextMatches = Object.entries(rule.conditions).every(
          ([key, value]) => context[key] === value
        );
        if (contextMatches) {
          score += 5;
        }
      }

      // Si el score es suficiente, devolver esta regla
      if (score >= 5) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Extraer variables del mensaje para usar en plantillas
   */
  private extractVariables(
    message: string,
    analysis: MessageAnalysis,
    rule: AutoResponseRule
  ): TemplateVariable {
    const variables: TemplateVariable = {
      mensaje_original: message,
      ...rule.variables
    };

    // Agregar entidades como variables
    Object.entries(analysis.entities).forEach(([key, value]) => {
      variables[key] = value;
    });

    // Variables específicas según el tipo de plantilla
    switch (rule.templateType) {
      case TemplateType.PRODUCT_FOUND:
        if (analysis.entities.products) {
          variables.busqueda = analysis.entities.products;
          variables.cantidad = 'varios';
        }
        break;
      
      case TemplateType.WELCOME:
        variables.nombre = 'amigo'; // Valor por defecto
        break;
    }

    return variables;
  }

  /**
   * Agregar nueva regla de respuesta automática
   */
  addRule(rule: AutoResponseRule): void {
    this.defaultRules.push(rule);
    this.logger.log(`Nueva regla agregada: ${rule.name}`);
  }

  /**
   * Obtener todas las reglas activas
   */
  getActiveRules(): AutoResponseRule[] {
    return this.defaultRules.filter(rule => rule.isActive);
  }

  /**
   * Activar/desactivar regla
   */
  toggleRule(ruleId: string, isActive: boolean): boolean {
    const rule = this.defaultRules.find(r => r.id === ruleId);
    if (rule) {
      rule.isActive = isActive;
      this.logger.log(`Regla ${rule.name} ${isActive ? 'activada' : 'desactivada'}`);
      return true;
    }
    return false;
  }

  /**
   * Verificar si un mensaje debe tener respuesta automática
   */
  shouldAutoRespond(message: string, context?: TemplateContext): boolean {
    const analysis = this.analyzeMessage(message);
    const rule = this.findMatchingRule(message, analysis, context);
    return rule !== null;
  }
} 