/**
 * Servicio especializado para manejar chatbots de tipo Valery.
 * Gestiona sesiones persistentes, autenticación automática, búsquedas inteligentes
 * y análisis de patrones de usuario para una experiencia personalizada.
 * 
 * @class ValeryChatbotService
 */
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ValeryDbService } from './valery-db.service';
import { TemplateService, TemplateContext } from '../chat/services/template.service';
import { AutoResponseService } from '../chat/services/auto-response.service';
import { ChatService } from '../chat/chat.service';
import { TemplateType } from '../chat/entities/message-template.entity';
import { PersistentSession } from '../chat/entities/persistent-session.entity';
import { SearchHistory } from '../chat/entities/search-history.entity';
import { ShoppingCart } from '../chat/entities/shopping-cart.entity';
import { ChatMessage } from '../chat/entities/message.entity';

interface EstadoChat {
  paso: number;
  cliente?: any;
  productos: any[];
  metodoPago?: any;
  banco?: any;
  total: number;
  subtotal: number;
  iva: number;
  tipoEntrega?: string;
  direccionEntrega?: string;
  cedulaRifIngresada?: string;
  nombreCompletoIngresado?: string;
  carritoCompras: any[];
  idPedidoCreado?: string;
  comprobanteInfo?: string;
  ocrMontoReportado?: string;
  ocrReferenciaReportada?: string;
  modoDebug?: boolean;
}

@Injectable()
export class ValeryChatbotService {
  private readonly logger = new Logger(ValeryChatbotService.name);
  private estadosChat: Map<string, EstadoChat> = new Map();
  private readonly SESSION_TIMEOUT = 2 * 60 * 60 * 1000; // 2 horas para sesiones persistentes

  constructor(
    private readonly configService: ConfigService,
    private valeryDbService: ValeryDbService,
    @Inject(forwardRef(() => TemplateService))
    private templateService: TemplateService,
    @Inject(forwardRef(() => AutoResponseService))
    private autoResponseService: AutoResponseService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService
  ) {
    this.logger.log('ValeryChatbotService inicializado con persistencia completa');
    // Limpiar sesiones inactivas cada 30 minutos
    setInterval(() => this.cleanInactiveSessions(), 30 * 60 * 1000);
  }

  async handleMessage(message: string, phoneNumber: string, chatbotId: string): Promise<string> {
    try {
      this.logger.debug(`📱 Procesando mensaje de ${phoneNumber}: ${message}`);
      
      // Normalizar número de teléfono
      const normalizedPhoneNumber = this.normalizePhoneNumber(phoneNumber);
      
      // Obtener o crear sesión persistente
      let session = await this.getOrCreateSession(normalizedPhoneNumber, chatbotId);
      
      // Si es una nueva sesión (messageCount === 0), buscar cliente automáticamente
      if (session.messageCount === 0) {
        await this.autoAuthenticateByPhone(session);
        
        // Incrementar messageCount ANTES de generar el mensaje de bienvenida
        session.messageCount += 1;
        session.lastActivity = new Date();
        session.lastUserMessage = message;
        
        await this.chatService.saveSession(session);
        
        // Generar saludo personalizado e inteligente
        const welcomeMessage = await this.generateIntelligentWelcome(session, chatbotId);
        session.lastBotResponse = welcomeMessage;
        await this.chatService.saveSession(session);
        await this.saveMessage(session, message, welcomeMessage);
        return welcomeMessage;
      }
      
      // Actualizar actividad de la sesión para mensajes subsiguientes
      session.lastActivity = new Date();
      session.lastUserMessage = message;
      session.messageCount += 1;
      
      // Analizar y procesar el mensaje con IA
      const response = await this.processIntelligentMessage(message, session, chatbotId);
      
      // Guardar el intercambio de mensajes
      session.lastBotResponse = response;
      await this.chatService.saveSession(session);
      await this.saveMessage(session, message, response);
      
      return response;
      
    } catch (error) {
      this.logger.error(`❌ Error crítico al procesar mensaje: ${error.message}`, error.stack);
      
      // Respuesta de error inteligente
      const errorMessage = await this.handleIntelligentError(error, chatbotId);
      return errorMessage;
    }
  }

  private async getOrCreateSession(phoneNumber: string, chatbotId: string): Promise<PersistentSession> {
    try {
      let session = await this.chatService.findSession(phoneNumber, 'active');

      if (!session) {
        session = this.chatService.createSession(phoneNumber, chatbotId, 'active');
        await this.chatService.saveSession(session);
        this.logger.debug(`🆕 Nueva sesión persistente creada: ${session.id}`);
      } else {
        // Verificar si la sesión ha expirado
        const timeSinceLastActivity = Date.now() - session.lastActivity.getTime();
        if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
          // Reactivar sesión expirada
          session.status = 'active';
          session.lastActivity = new Date();
          this.logger.debug(`🔄 Sesión reactivada: ${session.id}`);
        }
      }

      return session;
    } catch (error) {
      this.logger.error(`Error al obtener/crear sesión: ${error.message}`);
      throw error;
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Limpiar y normalizar número de teléfono
    const cleanNumber = phoneNumber.replace(/@s\.whatsapp\.net|[\s\-\(\)]/g, '');
    
    // Convertir formato internacional a local venezolano
    if (cleanNumber.startsWith('58') && cleanNumber.length > 10) {
      return '0' + cleanNumber.slice(2);
    }
    
    return cleanNumber;
  }

  private async autoAuthenticateByPhone(session: PersistentSession): Promise<void> {
    try {
      this.logger.debug(`🔍 Buscando cliente por teléfono: ${session.phoneNumber}`);
      
      const query = `
        SELECT 
          c.codigocliente,
          c.nombre,
          c.direccion1,
          c.telefono1,
          c.telefono2,
          c.status,
          c.rif,
          c.tienecredito,
          c.diascredito,
          c.saldo,
          c.fechaultimaventa,
          c.fechacreacion
        FROM clientes c
        WHERE c.telefono1 = $1 OR c.telefono2 = $1
        ORDER BY c.fechaultimaventa DESC NULLS LAST
        LIMIT 1
      `;
      
      const results = await this.valeryDbService.ejecutarQuery(query, [session.phoneNumber]);
      
      if (results && results.length > 0) {
        const cliente = results[0];
        
        // Cliente encontrado - autenticar automáticamente
        session.clientId = cliente.codigocliente;
        session.clientName = cliente.nombre;
        session.identificationNumber = cliente.rif;
        session.isAuthenticated = true;
        session.isNewClient = false;
        session.context = 'menu';
        session.metadata = {
          ...session.metadata,
          clientInfo: {
            hasCredit: !!cliente.tienecredito,
            creditDays: cliente.diascredito,
            balance: cliente.saldo,
            lastPurchase: cliente.fechaultimaventa,
            registrationDate: cliente.fechacreacion
          }
        };
        
        this.logger.debug(`✅ Cliente autenticado: ${cliente.nombre} (${cliente.codigocliente})`);
      } else {
        // Cliente no encontrado
        session.isNewClient = true;
        session.isAuthenticated = false;
        session.context = 'new_client';
        
        this.logger.debug(`👤 Cliente nuevo detectado: ${session.phoneNumber}`);
      }
    } catch (error) {
      this.logger.error(`Error en autenticación automática: ${error.message}`);
      // En caso de error, tratar como cliente nuevo
      session.isNewClient = true;
      session.isAuthenticated = false;
      session.context = 'error_fallback';
    }
  }

  private async generateIntelligentWelcome(session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const currentHour = new Date().getHours();
      let timeGreeting = this.getTimeBasedGreeting(currentHour);
      
      if (session.isAuthenticated && !session.isNewClient) {
        // Cliente existente - saludo personalizado con análisis de comportamiento
        const recentSearches = await this.getRecentSearches(session.phoneNumber, 5);
        const cartItems = await this.getActiveCartItems(session.phoneNumber);
        
        let personalizedMessage = `🎉 ${timeGreeting}, **${session.clientName}**! 🌟\n`;
        personalizedMessage += `═══════════════════════════\n`;
        personalizedMessage += `✨ ¡Qué alegría tenerle de vuelta en **GómezMarket**! ✨\n\n`;
        
        // Añadir información contextual inteligente
        if (cartItems.length > 0) {
          personalizedMessage += `🛒 **CARRITO GUARDADO** 🛒\n`;
          personalizedMessage += `📦 Tiene ${cartItems.length} producto(s) esperándole\n`;
          personalizedMessage += `💾 Todo guardado y listo para continuar\n\n`;
        }
        
        if (recentSearches.length > 0) {
          const lastSearch = recentSearches[0];
          const daysSinceLastSearch = Math.floor((Date.now() - lastSearch.createdAt.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastSearch <= 7) {
            personalizedMessage += `🔍 **BÚSQUEDAS RECIENTES** 🔍\n`;
            personalizedMessage += `💡 ¿Busca algo similar a "${lastSearch.originalSearchTerm}"?\n`;
            personalizedMessage += `📈 Tenemos nuevas ofertas disponibles\n\n`;
          }
        }
        
        personalizedMessage += `🎯 **¿EN QUÉ LE PUEDO AYUDAR HOY?** 🎯\n`;
        personalizedMessage += `═══════════════════════════\n\n`;
        personalizedMessage += `1️⃣ 🔍 **Consultar productos** → Buscar ofertas\n`;
        personalizedMessage += `2️⃣ 💰 **Ver mi saldo** → Estado de cuenta\n`;
        personalizedMessage += `3️⃣ 📄 **Historial facturas** → Mis compras\n`;
        personalizedMessage += `4️⃣ 🛒 **Hacer un pedido** → ¡Comprar ahora!\n\n`;
        personalizedMessage += `💬 O simplemente escriba lo que necesita... 🚀`;
        
        return personalizedMessage;
      } else {
        // Cliente nuevo - bienvenida impactante
        return `🎊 ${timeGreeting}! 🎊\n` +
               `═══════════════════════════\n` +
               `🌟 **¡BIENVENIDO A GÓMEZMARKET!** 🌟\n` +
               `🤖 Soy **GómezBot**, su asistente personal\n\n` +
               `🎯 **PARA COMENZAR** 🎯\n` +
               `═══════════════════════════\n` +
               `📝 Indíqueme su **cédula o RIF**\n` +
               `✨ Le ofreceré un servicio personalizado\n` +
               `🚀 ¡Descubra nuestras ofertas exclusivas!\n\n` +
               `📌 **Ejemplo:** V12345678 o J408079305\n` +
               `💎 ¡Su experiencia premium comienza aquí! 💎`;
      }
    } catch (error) {
      this.logger.error(`Error generando bienvenida: ${error.message}`);
      return `🎉 ¡BIENVENIDO A GÓMEZMARKET! 🎉\n` +
             `═══════════════════════════\n` +
             `🤖 Soy **GómezBot** 🚀\n` +
             `✨ ¿En qué puedo ayudarle hoy? ✨`;
    }
  }

  private getTimeBasedGreeting(hour: number): string {
    if (hour >= 6 && hour <= 11) return '🌅 ¡BUENOS DÍAS';
    if (hour >= 12 && hour <= 18) return '☀️ ¡BUENAS TARDES';
    if (hour > 18 && hour <= 23) return '🌙 ¡BUENAS NOCHES';
    return '🌜 ¡BUENA MADRUGADA';
  }

  private async processIntelligentMessage(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      // Normalizar y analizar el mensaje
      const normalizedMessage = this.normalizeMessage(message);
      const messageIntent = await this.analyzeMessageIntent(normalizedMessage, session);
      
      this.logger.debug(`🧠 Intención detectada: ${messageIntent.type} (confianza: ${messageIntent.confidence})`);
      
      // Si está en proceso de registro, manejar el registro
      if (session.context === 'new_client_registration') {
        return await this.handleNewClientRegistration(message, session, chatbotId);
      }
      
      // Si está en selección de método de pago
      if (session.context === 'checkout_payment_selection') {
        if (message.toLowerCase().includes('cancelar')) {
          session.context = 'menu';
          await this.chatService.saveSession(session);
          return `🔄 **CHECKOUT CANCELADO** 🔄\n` +
                 `═══════════════════════════\n` +
                 `↩️ Regresando al menú principal\n` +
                 `🛒 Su carrito se mantiene intacto\n\n` +
                 `🎯 **¿Qué desea hacer?**\n` +
                 `═══════════════════════════\n` +
                 `🔍 Seguir comprando\n` +
                 `👀 Ver carrito\n` +
                 `💬 Buscar productos`;
        }
        return await this.handlePaymentSelection(message, session, chatbotId);
      }

      // Nuevos contextos para validación de pago móvil
      if (session.context === 'payment_bank_selection') {
        return await this.handleBankSelection(message, session, chatbotId);
      }

      if (session.context === 'payment_phone_input') {
        return await this.handlePaymentPhoneInput(message, session, chatbotId);
      }

      if (session.context === 'payment_cedula_input') {
        return await this.handlePaymentCedulaInput(message, session, chatbotId);
      }

      if (session.context === 'payment_reference_input') {
        return await this.handlePaymentReferenceInput(message, session, chatbotId);
      }

      // Manejo de búsqueda por listas
      if (session.context === 'product_search' && this.esListaProductos(message)) {
        return await this.handleProductListSearch(message, session, chatbotId);
      }
      
      // Procesar según la intención y contexto
      switch (messageIntent.type) {
        case 'product_search':
          return await this.handleIntelligentProductSearch(messageIntent.entities.searchTerm, session, chatbotId);
          
        case 'menu_option':
          return await this.handleMenuOption(messageIntent.entities.option, session, chatbotId);
          
        case 'cart_action':
          return await this.handleCartAction(messageIntent.entities.action, messageIntent.entities.product, session, chatbotId);
          
        case 'identification':
          return await this.handleClientIdentification(messageIntent.entities.identification, session, chatbotId);
          
        case 'greeting':
          return await this.handleGreeting(session, chatbotId);
          
        case 'help':
          return await this.handleHelpRequest(session, chatbotId);
          
        default:
          return await this.handleUnknownIntent(message, session, chatbotId);
      }
    } catch (error) {
      this.logger.error(`Error procesando mensaje inteligente: ${error.message}`);
      return await this.handleIntelligentError(error, chatbotId);
    }
  }

  private async handleIntelligentProductSearch(searchTerm: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      session.context = 'product_search';
      session.searchCount += 1;
      
      // Normalizar término de búsqueda
      const normalizedSearchTerm = this.normalizeSearchTerm(searchTerm);
      
      // Búsqueda inteligente con múltiples estrategias
      const searchStrategies = [
        // Búsqueda exacta
        { term: normalizedSearchTerm, type: 'exact' },
        // Búsqueda por palabras individuales
        { term: normalizedSearchTerm, type: 'words' },
        // Búsqueda con sinónimos (si implementas)
        // { term: await this.expandWithSynonyms(normalizedSearchTerm), type: 'synonyms' }
      ];
      
      let productos = [];
      let searchType = '';
      
      for (const strategy of searchStrategies) {
        productos = await this.searchProductsWithStrategy(strategy.term, strategy.type);
        if (productos.length > 0) {
          searchType = strategy.type;
          break;
        }
      }
      
      // Guardar búsqueda en historial
      await this.saveSearchHistory(session, searchTerm, normalizedSearchTerm, productos.length, chatbotId);
      
      if (productos.length === 0) {
        // Sugerir búsquedas alternativas basadas en historial
        const suggestions = await this.getSimilarSearchSuggestions(session.phoneNumber, normalizedSearchTerm);
        
        let response = `😔 **¡NO ENCONTRAMOS PRODUCTOS!** 😔\n`;
        response += `═══════════════════════════\n`;
        response += `🔍 Búsqueda: "${searchTerm}"\n`;
        response += `❌ Sin resultados disponibles\n\n`;
        
        if (suggestions.length > 0) {
          response += `💡 **¿QUIZÁS BUSCABA ESTO?** 💡\n`;
          response += `═══════════════════════════\n`;
          suggestions.forEach((suggestion, index) => {
            response += `${index + 1}️⃣ ${suggestion}\n`;
          });
          response += `\n`;
        }
        
        response += `🎯 **SUGERENCIAS:** 🎯\n`;
        response += `═══════════════════════════\n`;
        response += `🔄 Intente con otra marca\n`;
        response += `📝 Use términos más generales\n`;
        response += `💬 Escriba "ayuda" para ejemplos\n\n`;
        response += `🚀 ¡Seguimos buscando para usted! 🚀`;
        
        return response;
      }
      
      // Formatear resultados con información inteligente
      return await this.formatIntelligentProductResults(productos, searchTerm, searchType, session);
      
    } catch (error) {
      this.logger.error(`Error en búsqueda inteligente: ${error.message}`);
      throw error;
    }
  }

  private async searchProductsWithStrategy(searchTerm: string, type: string): Promise<any[]> {
    let query = '';
    let params = [];
    
    // DIAGNÓSTICO TEMPORAL - Consulta de ejemplo para ver qué productos existen
    try {
      const diagnosticQuery = `
        SELECT 
          i.codigo,
          i.nombre,
          i.preciounidad,
          i.alicuotaiva,
          i.existenciaunidad,
          i.status,
          (SELECT factorcambio FROM monedas WHERE codmoneda = '02' LIMIT 1) AS tasa_actual
        FROM inventario i
        WHERE LOWER(i.nombre) LIKE '%azucar%' OR LOWER(i.nombre) LIKE '%pasta%'
        ORDER BY i.nombre
        LIMIT 10
      `;
      
      const diagnosticResults = await this.valeryDbService.ejecutarQuery(diagnosticQuery);
      this.logger.log(`🔍 DIAGNÓSTICO - Productos con 'azucar' o 'pasta': ${JSON.stringify(diagnosticResults, null, 2)}`);
      
      // También verificar algunos productos al azar
      const randomQuery = `
        SELECT 
          i.codigo,
          i.nombre,
          i.preciounidad,
          i.existenciaunidad,
          i.status
        FROM inventario i
        LIMIT 5
      `;
      
      const randomResults = await this.valeryDbService.ejecutarQuery(randomQuery);
      this.logger.log(`🔍 DIAGNÓSTICO - Productos al azar: ${JSON.stringify(randomResults, null, 2)}`);
      
    } catch (diagnosticError) {
      this.logger.error(`Error en diagnóstico: ${diagnosticError.message}`);
    }
    
    switch (type) {
      case 'exact':
        query = `
          SELECT 
            i.codigo,
            i.nombre,
            i.preciounidad,
            i.alicuotaiva,
            i.existenciaunidad,
            (SELECT factorcambio FROM monedas WHERE codmoneda = '02' LIMIT 1) AS tasa_actual
          FROM inventario i
          WHERE (i.status = 'A' OR i.status = '1')
            AND i.existenciaunidad >= 2
            AND LOWER(TRANSLATE(i.nombre, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU')) LIKE LOWER(TRANSLATE($1, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU'))
          ORDER BY 
            CASE WHEN LOWER(TRANSLATE(i.nombre, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU')) LIKE LOWER(TRANSLATE($2, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU')) THEN 0 ELSE 1 END,
            i.existenciaunidad DESC,
            LENGTH(i.nombre),
            i.nombre
          LIMIT 20
        `;
        params = [`%${searchTerm}%`, `${searchTerm}%`];
        break;
        
      case 'words':
        const words = searchTerm.split(' ').filter(word => word.length > 2);
        if (words.length === 0) return [];
        
        // Construir condiciones y parámetros correctamente
        const conditions = [];
        const wordParams = [];
        
        for (let i = 0; i < words.length; i++) {
          conditions.push(`LOWER(TRANSLATE(i.nombre, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU')) LIKE LOWER(TRANSLATE($${i + 1}, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU'))`);
          wordParams.push(`%${words[i]}%`);
        }
        
        query = `
          SELECT 
            i.codigo,
            i.nombre,
            i.preciounidad,
            i.alicuotaiva,
            i.existenciaunidad,
            (SELECT factorcambio FROM monedas WHERE codmoneda = '02' LIMIT 1) AS tasa_actual
          FROM inventario i
          WHERE (i.status = 'A' OR i.status = '1')
            AND i.existenciaunidad >= 2
            AND (${conditions.join(' AND ')})
          ORDER BY i.existenciaunidad DESC, i.nombre
          LIMIT 15
        `;
        params = wordParams;
        break;
    }
    
    const results = await this.valeryDbService.ejecutarQuery(query, params);
    this.logger.log(`🔍 Búsqueda "${searchTerm}" (${type}): ${results.length} resultados`);
    
    return results;
  }

  private async formatIntelligentProductResults(productos: any[], searchTerm: string, searchType: string, session: PersistentSession): Promise<string> {
    let respuesta = `🛍️ **¡PRODUCTOS ENCONTRADOS!** 🛍️\n`;
    respuesta += `═══════════════════════════\n`;
    respuesta += `🔍 Búsqueda: "${searchTerm}"\n`;
    respuesta += `📦 ${productos.length} productos disponibles\n\n`;
    
    for (let i = 0; i < productos.length; i++) {
      const p = productos[i];
      if (!p.nombre || !p.preciounidad || !p.tasa_actual) continue;

      const precioUSD = (parseFloat(p.preciounidad) || 0).toFixed(2);
      const precioBs = this.calcularPrecioBs(p.preciounidad, p.alicuotaiva, p.tasa_actual).toFixed(2);

      respuesta += `🏷️ **PRODUCTO ${i + 1}** 🏷️\n`;
      respuesta += `📌 **${p.nombre}**\n`;
      respuesta += `💵 **USD:** $${precioUSD}\n`;
      respuesta += `🇻🇪 **Bolívares:** Bs ${precioBs}\n\n`;
    }
    
    // Añadir información contextual inteligente
    if (searchType === 'words') {
      respuesta += `💡 **BÚSQUEDA EXPANDIDA** 💡\n`;
      respuesta += `🎯 Resultados por palabras clave\n\n`;
    }
    
    respuesta += `🛒 **¿CÓMO AGREGAR AL CARRITO?** 🛒\n`;
    respuesta += `═══════════════════════════\n`;
    respuesta += `✅ "Agregar [número] al carrito"\n`;
    respuesta += `✅ "Quiero el producto [número]"\n\n`;
    respuesta += `🔍 **¿Desea refinar su búsqueda?** 🔍\n`;
    respuesta += `💬 ¡Escriba otra consulta o elija opciones! 🚀`;
    
    return respuesta;
  }

  // Función para calcular precio en Bs con IVA y redondear al múltiplo más cercano
  private calcularPrecioBs(precioUSD: number | string, alicuota: number | string, tasa: number | string): number {
    const base = Number(precioUSD) || 0;
    const iva = Number(alicuota) || 0;
    const tasaCambio = Number(tasa) || 1;
    const conIVA = base * (1 + (iva / 100));
    const bs = conIVA * tasaCambio;
    return Math.round(bs * 10) / 10; // redondeo al múltiplo de 0.10
  }

  private normalizeMessage(message: string): string {
    return message.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSearchTerm(term: string): string {
    return term.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async analyzeMessageIntent(message: string, session: PersistentSession): Promise<any> {
    // Análisis básico de intenciones (puedes expandir con NLP más avanzado)
    const patterns = {
      product_search: [
        /busco?|buscar|necesito|quiero(?!\s+(el\s+)?producto\s+\d)|dame|tienes?|hay|vendo?|vender/,
        /producto(?!\s+\d)|marca|presentacion|litro|kilo|gramo|paquete/
      ],
      menu_option: [
        /^[1-4]$|^[1-4]️⃣$|saldo|factura|pedido(?!\s)|historial/
      ],
      cart_action: [
        /carrito|agregar|añadir|quitar|eliminar|comprar(?!\s)|finalizar|proceder/,
        /quiero\s+(el\s+)?producto\s+\d+|agregar\s+producto\s+\d+|producto\s+\d+\s+al\s+carrito/,
        /ver\s+carrito|mi\s+carrito|vaciar\s+carrito|limpiar\s+carrito/
      ],
      identification: [
        /^[vVeEjJpP]?-?\d{6,9}$/
      ],
      greeting: [
        /hola|buenos?|buenas?|saludos|hey|hi/
      ],
      help: [
        /ayuda|help|como|que puedo|opciones|menu/
      ]
    };
    
    let bestMatch = { type: 'unknown', confidence: 0, entities: {} };
    
    for (const [intentType, regexList] of Object.entries(patterns)) {
      for (const regex of regexList) {
        if (regex.test(message)) {
          const confidence = this.calculateIntentConfidence(message, intentType);
          if (confidence > bestMatch.confidence) {
            bestMatch = {
              type: intentType,
              confidence,
              entities: this.extractEntities(message, intentType)
            };
          }
        }
      }
    }
    
    return bestMatch;
  }

  private calculateIntentConfidence(message: string, intentType: string): number {
    // Lógica simple de confianza (expandir con ML)
    const baseConfidence = 0.7;
    const lengthFactor = Math.min(message.length / 10, 1);
    return Math.min(baseConfidence + lengthFactor * 0.3, 1);
  }

  private extractEntities(message: string, intentType: string): any {
    const entities: any = {};
    
    switch (intentType) {
      case 'product_search':
        // Extraer término de búsqueda eliminando palabras comunes
        const stopWords = ['busco', 'necesito', 'quiero', 'dame', 'tienes', 'hay', 'me', 'puedes', 'dar'];
        const words = message.split(' ').filter(word => 
          word.length > 2 && !stopWords.includes(word.toLowerCase())
        );
        entities.searchTerm = words.join(' ');
        break;
        
      case 'menu_option':
        const optionMatch = message.match(/[1-4]/);
        entities.option = optionMatch ? optionMatch[0] : null;
        break;

      case 'cart_action':
        // Extraer acción del carrito y número de producto si existe
        entities.action = message.toLowerCase();
        
        // Buscar número de producto
        const productNumberMatch = message.match(/producto\s+(\d+)|(\d+)/);
        if (productNumberMatch) {
          entities.product = productNumberMatch[1] || productNumberMatch[2];
        }
        break;
        
      case 'identification':
        entities.identification = message.replace(/[^a-zA-Z0-9]/g, '');
        break;
    }
    
    return entities;
  }
  private async handleMenuOption(option: string, session: PersistentSession, chatbotId: string): Promise<string> {
    if (!session.isAuthenticated) {
      return `🔐 **AUTENTICACIÓN REQUERIDA** 🔐\n` +
             `═══════════════════════════\n` +
             `🚫 Debe identificarse primero\n` +
             `📝 Ingrese su cédula o RIF\n` +
             `✨ ¡Acceso personalizado garantizado! ✨`;
    }
    
    switch (option) {
      case '1':
        session.context = 'product_search';
        return `🔍 **¡BÚSQUEDA DE PRODUCTOS!** 🔍\n` +
               `═══════════════════════════\n` +
               `🎯 ¿Qué producto busca?\n` +
               `💡 Puede escribir:\n` +
               `▪️ Nombre del producto\n` +
               `▪️ Marca específica\n` +
               `▪️ Categoría\n\n` +
               `📝 **Ejemplos:**\n` +
               `🥛 "leche completa"\n` +
               `🍞 "pan integral"\n` +
               `🧴 "champú bebé"\n\n` +
               `🚀 ¡Escriba y descubra nuestras ofertas! 🚀`;
        
      case '2':
        return await this.getSaldoCliente(session);
        
      case '3':
        return `📄 **HISTORIAL DE FACTURAS** 📄\n` +
               `═══════════════════════════\n` +
               `🚧 Funcionalidad en desarrollo\n` +
               `⚙️ Próximamente disponible\n` +
               `📞 Mientras tanto, contacte servicio\n` +
               `🔄 ¡Trabajamos para mejorar! 🔄`;
        
      case '4':
        session.context = 'order_start';
        return `🛒 **¡CREAR NUEVO PEDIDO!** 🛒\n` +
               `═══════════════════════════\n` +
               `🎯 **OPCIONES DISPONIBLES:**\n\n` +
               `1️⃣ 🔍 **Buscar productos**\n` +
               `    → Explorar catálogo\n\n` +
               `2️⃣ 📝 **Lista de productos**\n` +
               `    → Escribir lo que necesita\n\n` +
               `💡 **¿Qué productos necesita?**\n` +
               `═══════════════════════════\n` +
               `💬 Escriba y comencemos... 🚀`;
        
      default:
        return `❌ **OPCIÓN NO VÁLIDA** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Seleccione del 1 al 4\n` +
               `💡 Use los números del menú\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
    }
  }

  private async getSaldoCliente(session: PersistentSession): Promise<string> {
    try {
      if (!session.clientId) {
        return `❌ **ERROR DE CUENTA** ❌\n` +
               `═══════════════════════════\n` +
               `🚫 No se encontró información\n` +
               `📞 Contacte servicio al cliente\n` +
               `🆘 ¡Estamos aquí para ayudarle! 🆘`;
      }
      
      const query = `
        SELECT 
          c.nombre,
          c.tienecredito,
          c.diascredito,
          c.saldo,
          c.fechaultimaventa
        FROM clientes c
        WHERE c.codigocliente = $1
      `;
      
      const results = await this.valeryDbService.ejecutarQuery(query, [session.clientId]);
      
      if (results && results.length > 0) {
        const cliente = results[0];
        
        let respuesta = `💰 **ESTADO DE CUENTA** 💰\n`;
        respuesta += `═══════════════════════════\n`;
        respuesta += `👤 **Cliente:** ${cliente.nombre}\n`;
        respuesta += `═══════════════════════════\n\n`;
        
        if (!cliente.tienecredito) {
          respuesta += `💳 **MODALIDAD DE PAGO** 💳\n`;
          respuesta += `📋 Tipo: **CONTADO**\n`;
          respuesta += `🚫 Sin línea de crédito activa\n`;
          respuesta += `💰 Pagos inmediatos requeridos\n\n`;
        } else {
          respuesta += `🏦 **CUENTA DE CRÉDITO** 🏦\n`;
          respuesta += `📋 Modalidad: **CRÉDITO**\n`;
          respuesta += `⏰ Plazo: ${cliente.diascredito} días\n`;
          respuesta += `💰 **Saldo actual:** ${this.formatearPrecio(cliente.saldo)}\n`;
          
          if (cliente.saldo > 0) {
            respuesta += `⚠️ **SALDO PENDIENTE** ⚠️\n`;
          } else {
            respuesta += `✅ **¡AL DÍA CON PAGOS!** ✅\n`;
          }
          respuesta += `\n`;
        }
        
        if (cliente.fechaultimaventa) {
          const diasUltimaCompra = Math.floor((Date.now() - new Date(cliente.fechaultimaventa).getTime()) / (1000 * 60 * 60 * 24));
          respuesta += `🛍️ **ÚLTIMA COMPRA** 🛍️\n`;
          respuesta += `📅 Hace ${diasUltimaCompra} días\n`;
          respuesta += `🔄 ¡Esperamos su próxima visita!\n\n`;
        }
        
        respuesta += `🎯 **¿QUÉ DESEA HACER?** 🎯\n`;
        respuesta += `═══════════════════════════\n`;
        respuesta += `🛒 ¡Realizar una nueva compra!\n`;
        respuesta += `📞 Contactar servicio al cliente\n`;
        respuesta += `💬 ¡Estoy aquí para ayudarle! 🚀`;
        
        return respuesta;
      } else {
        return `❌ **ERROR DE CONSULTA** ❌\n` +
               `═══════════════════════════\n` +
               `🚫 No se pudo obtener información\n` +
               `📞 Contacte servicio al cliente\n` +
               `🆘 Error ID: ${Date.now().toString(36)} 🆘`;
      }
    } catch (error) {
      this.logger.error(`Error consultando saldo: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error consultando saldo\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async handleClientIdentification(identification: string, session: PersistentSession, chatbotId: string): Promise<string> {
    return await this.authenticateClientByCedula(identification, session, chatbotId);
  }

  private async authenticateClientByCedula(cedula: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const normalizedCedula = this.normalizeIdentification(cedula);
      
      const query = `
        SELECT 
          c.codigocliente,
          c.nombre,
          c.rif,
          c.direccion1,
          c.telefono1,
          c.telefono2,
          c.tienecredito,
          c.diascredito,
          c.saldo,
          c.status
        FROM clientes c
        WHERE c.rif = $1 OR c.rif = $2
        LIMIT 1
      `;
      
      const results = await this.valeryDbService.ejecutarQuery(query, [normalizedCedula, `V${normalizedCedula}`]);
      
      if (results && results.length > 0) {
        const cliente = results[0];
        
        // Actualizar sesión
        session.clientId = cliente.codigocliente;
        session.clientName = cliente.nombre;
        session.identificationNumber = normalizedCedula;
        session.isAuthenticated = true;
        session.isNewClient = false;
        session.context = 'menu';
        
        await this.chatService.saveSession(session);
        
        return `🎉 **¡IDENTIFICACIÓN EXITOSA!** 🎉\n` +
               `═══════════════════════════\n` +
               `✅ **¡Bienvenido ${cliente.nombre}!** ✅\n` +
               `🔐 Autenticado correctamente\n` +
               `🌟 ¡Listo para atenderle!\n\n` +
               `🎯 **¿CÓMO LE PUEDO AYUDAR?** 🎯\n` +
               `═══════════════════════════\n\n` +
               `1️⃣ 🔍 **Consultar productos** → Ver catálogo\n` +
               `2️⃣ 💰 **Ver mi saldo** → Estado cuenta\n` +
               `3️⃣ 📄 **Historial facturas** → Mis compras\n` +
               `4️⃣ 🛒 **Hacer un pedido** → ¡Primera compra!\n\n` +
               `💬 O escriba directamente lo que necesita... 🚀`;
      } else {
        // Cliente no encontrado - iniciar proceso de registro
        session.identificationNumber = normalizedCedula;
        session.isNewClient = true;
        session.isAuthenticated = false;
        session.context = 'new_client_registration';
        
        await this.chatService.saveSession(session);
        
        return `🆕 **¡NUEVO CLIENTE DETECTADO!** 🆕\n` +
               `═══════════════════════════\n` +
               `📋 Cédula/RIF: ${normalizedCedula}\n` +
               `🚫 No existe en nuestros registros\n\n` +
               `✨ **¡REGISTREMOS SU CUENTA!** ✨\n` +
               `═══════════════════════════\n` +
               `🎁 Proceso rápido y ofertas especiales\n` +
               `🔒 Sus datos están seguros con nosotros\n\n` +
               `📝 **PASO 1 DE 1:**\n` +
               `═══════════════════════════\n` +
               `👤 Por favor, escriba su **NOMBRE COMPLETO**\n` +
               `💡 Ejemplo: "Juan Carlos Pérez González"\n\n` +
               `🚀 ¡Su experiencia premium comienza aquí! 🚀`;
      }
    } catch (error) {
      this.logger.error(`Error autenticando por cédula: ${error.message}`);
      return `❌ **ERROR DE VERIFICACIÓN** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error técnico temporal\n` +
             `⏰ Intente nuevamente\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private normalizeIdentification(cedula: string): string {
    return cedula.replace(/[^\d]/g, '');
  }

  private async handleGreeting(session: PersistentSession, chatbotId: string): Promise<string> {
    if (session.isAuthenticated) {
      return `🎉 **¡HOLA DE NUEVO!** 🎉\n` +
             `═══════════════════════════\n` +
             `😊 ${session.clientName}\n` +
             `✨ ¡Qué gusto saludarle!\n\n` +
             `🎯 **¿EN QUÉ LE AYUDO HOY?** 🎯\n` +
             `═══════════════════════════\n` +
             `💬 ¡Estoy aquí para servirle! 🚀`;
    } else {
      return `👋 **¡HOLA Y BIENVENIDO!** 👋\n` +
             `═══════════════════════════\n` +
             `🌟 **GómezMarket** a su servicio\n` +
             `🤖 Soy **GómezBot**\n\n` +
             `🔐 **PARA COMENZAR:**\n` +
             `═══════════════════════════\n` +
             `📝 Indique su cédula o RIF\n` +
             `✨ ¡Servicio personalizado garantizado! ✨`;
    }
  }

  private async handleHelpRequest(session: PersistentSession, chatbotId: string): Promise<string> {
    let helpMessage = `🆘 **¡CENTRO DE AYUDA!** 🆘\n`;
    helpMessage += `═══════════════════════════\n`;
    helpMessage += `🤖 **GómezBot** - Su asistente\n\n`;
    helpMessage += `💬 **COMANDOS DISPONIBLES:**\n`;
    helpMessage += `═══════════════════════════\n`;
    helpMessage += `🔍 **Buscar:** "busco aceite" o "necesito arroz"\n`;
    helpMessage += `🔢 **Opciones:** Escriba números 1-4\n`;
    helpMessage += `🛒 **Carrito:** "agregar producto 1"\n`;
    helpMessage += `👀 **Ver carrito:** "mi carrito"\n\n`;
    
    if (session.isAuthenticated) {
      helpMessage += `🎯 **SUS OPCIONES:**\n`;
      helpMessage += `═══════════════════════════\n`;
      helpMessage += `1️⃣ 🔍 **Consultar productos**\n`;
      helpMessage += `2️⃣ 💰 **Ver saldo**\n`;
      helpMessage += `3️⃣ 📄 **Historial**\n`;
      helpMessage += `4️⃣ 🛒 **Hacer pedido**\n\n`;
    }
    
    helpMessage += `🧠 **¡INTELIGENCIA ARTIFICIAL!**\n`;
    helpMessage += `═══════════════════════════\n`;
    helpMessage += `💬 Escriba naturalmente\n`;
    helpMessage += `🤖 ¡Entiendo su lenguaje!\n`;
    helpMessage += `🚀 ¡Estoy aquí para ayudarle! 🚀`;
    
    return helpMessage;
  }

  private async handleUnknownIntent(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    // Si no se entiende el mensaje, intentar una búsqueda de productos
    if (message.length > 3) {
      return await this.handleIntelligentProductSearch(message, session, chatbotId);
    }
    
    return `🤔 **¿PODRÍA SER MÁS ESPECÍFICO?** 🤔\n` +
           `═══════════════════════════\n` +
           `❓ No entendí completamente\n\n` +
           `💡 **PUEDE INTENTAR:**\n` +
           `═══════════════════════════\n` +
           `🔍 Buscar productos específicos\n` +
           `📝 Escribir números 1-4 para opciones\n` +
           `🆘 Escribir "ayuda" para más info\n\n` +
           `💬 ¡Escriba naturalmente! 🚀`;
  }

  private async handleIntelligentError(error: Error, chatbotId: string): Promise<string> {
    const errorId = Date.now().toString(36);
    this.logger.error(`Error ID ${errorId}: ${error.message}`);
    
    return `😅 **¡UPS! INCONVENIENTE TÉCNICO** 😅\n` +
           `═══════════════════════════\n` +
           `🔧 Pequeño problema temporal\n` +
           `⚡ Nuestro equipo ya fue notificado\n\n` +
           `🆔 **ID de error:** ${errorId}\n\n` +
           `🔄 **¿QUÉ PUEDE HACER?**\n` +
           `═══════════════════════════\n` +
           `⏰ Intente nuevamente\n` +
           `📞 Contacte soporte si persiste\n` +
           `🚀 ¡Estamos aquí para ayudarle! 🚀`;
  }

  // Métodos auxiliares para persistencia
  private async saveMessage(session: PersistentSession, userMessage: string, botResponse: string): Promise<void> {
    try {
      // Guardar mensaje del usuario
      await this.chatService.saveMessage(session, userMessage, 'user');
      
      // Guardar respuesta del bot
      await this.chatService.saveMessage(session, botResponse, 'assistant');
    } catch (error) {
      this.logger.error(`Error guardando mensajes: ${error.message}`);
    }
  }

  private async saveSearchHistory(session: PersistentSession, originalTerm: string, normalizedTerm: string, resultsCount: number, chatbotId: string): Promise<void> {
    try {
      await this.chatService.saveSearchHistory(session, originalTerm, normalizedTerm, resultsCount, chatbotId);
    } catch (error) {
      this.logger.error(`Error guardando historial de búsqueda: ${error.message}`);
    }
  }

  private async getRecentSearches(phoneNumber: string, limit: number = 5): Promise<SearchHistory[]> {
    try {
      return await this.chatService.findRecentSearches(phoneNumber, limit);
    } catch (error) {
      this.logger.error(`Error obteniendo búsquedas recientes: ${error.message}`);
      return [];
    }
  }

  private async getActiveCartItems(phoneNumber: string): Promise<ShoppingCart[]> {
    try {
      return await this.chatService.findActiveCartItems(phoneNumber);
    } catch (error) {
      this.logger.error(`Error obteniendo carrito: ${error.message}`);
      return [];
    }
  }

  private async getSimilarSearchSuggestions(phoneNumber: string, searchTerm: string, limit: number = 3): Promise<string[]> {
    try {
      const recentSearches = await this.chatService.findSimilarSearchSuggestions(phoneNumber, searchTerm, limit);
      
      return recentSearches.map(row => row.term);
    } catch (error) {
      this.logger.error(`Error obteniendo sugerencias: ${error.message}`);
      return [];
    }
  }

  private async cleanInactiveSessions(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - this.SESSION_TIMEOUT);
      
      const result = await this.chatService.cleanInactiveSessions(cutoffDate);
      
      if (result.affected > 0) {
        this.logger.debug(`🧹 Marcadas ${result.affected} sesiones como inactivas`);
      }
    } catch (error) {
      this.logger.error(`Error limpiando sesiones inactivas: ${error.message}`);
    }
  }

  private formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(precio);
  }

  // Métodos adicionales que se pueden implementar...
  private async handleCartAction(action: string, product: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      if (action.includes('agregar') || action.includes('añadir') || action.includes('quiero')) {
        // Extraer número de producto
        const productNumber = this.extractProductNumber(action);
        
        if (productNumber === null) {
          return `❌ **NÚMERO DE PRODUCTO REQUERIDO** ❌\n` +
                 `═══════════════════════════\n` +
                 `🔢 Especifique el número del producto\n` +
                 `💡 Ejemplo: "Agregar producto 1 al carrito"\n` +
                 `💡 Ejemplo: "Quiero el producto 3"\n\n` +
                 `🔄 ¡Intente nuevamente! 🔄`;
        }

        return await this.addProductToCart(productNumber, session, chatbotId);
      }
      
      if (action.includes('ver carrito') || action.includes('mi carrito') || action.includes('carrito')) {
        return await this.showCart(session);
      }
      
      if (action.includes('quitar') || action.includes('eliminar') || action.includes('remover')) {
        const productNumber = this.extractProductNumber(action);
        return await this.removeProductFromCart(productNumber, session);
      }
      
      if (action.includes('vaciar carrito') || action.includes('limpiar carrito')) {
        return await this.clearUserCart(session);
      }

      if (action.includes('proceder') || action.includes('comprar') || action.includes('finalizar')) {
        return await this.proceedToCheckout(session, chatbotId);
      }

      return `🛒 **ACCIÓN DE CARRITO NO RECONOCIDA** 🛒\n` +
             `═══════════════════════════\n` +
             `❓ No entendí la acción solicitada\n\n` +
             `🔧 **ACCIONES DISPONIBLES:**\n` +
             `═══════════════════════════\n` +
             `➕ Agregar producto [número] al carrito\n` +
             `👀 Ver mi carrito\n` +
             `➖ Quitar producto [número]\n` +
             `🗑️ Vaciar carrito\n` +
             `💳 Proceder a comprar\n\n` +
             `💬 ¡Escriba una de estas opciones! 🚀`;
             
    } catch (error) {
      this.logger.error(`Error en acción de carrito: ${error.message}`);
      return `❌ **ERROR EN CARRITO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando acción\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private extractProductNumber(message: string): number | null {
    // Buscar números en el mensaje
    const numbers = message.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      return parseInt(numbers[0]);
    }
    return null;
  }

  private async addProductToCart(productNumber: number, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      // Necesitamos obtener los productos de la búsqueda más reciente
      // Por ahora, voy a usar una búsqueda temporal. Idealmente deberíamos guardar 
      // los resultados de la última búsqueda en la sesión
      
      // Obtener la última búsqueda
      const recentSearches = await this.getRecentSearches(session.phoneNumber, 1);
      
      if (recentSearches.length === 0) {
        return `❌ **SIN BÚSQUEDAS RECIENTES** ❌\n` +
               `═══════════════════════════\n` +
               `🔍 Debe buscar productos primero\n` +
               `💡 Escriba el nombre de un producto\n` +
               `🚀 ¡Busque y después agregue al carrito! 🚀`;
      }

      // Repetir la búsqueda para obtener los productos
      const lastSearch = recentSearches[0];
      const productos = await this.searchProductsWithStrategy(lastSearch.searchTerm, 'exact');
      
      if (productNumber < 1 || productNumber > productos.length) {
        return `❌ **NÚMERO DE PRODUCTO INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Número válido: 1 a ${productos.length}\n` +
               `📋 Verifique la lista de productos\n` +
               `🔄 ¡Intente con otro número! 🔄`;
      }

      const producto = productos[productNumber - 1];
      
      // Agregar al carrito
      const cartItem = await this.chatService.addToCart(session, producto, 1, chatbotId);
      
      // Calcular totales del carrito
      const cartTotals = await this.chatService.getCartTotal(session.phoneNumber);
      
      return `✅ **¡PRODUCTO AGREGADO AL CARRITO!** ✅\n` +
             `═══════════════════════════\n` +
             `📦 **Producto agregado:**\n` +
             `🏷️ ${producto.nombre}\n` +
             `💵 $${parseFloat(producto.preciounidad).toFixed(2)} USD\n` +
             `🔢 Cantidad: 1 unidad\n\n` +
             `🛒 **RESUMEN DEL CARRITO:**\n` +
             `═══════════════════════════\n` +
             `📊 ${cartTotals.itemCount} productos en total\n` +
             `💰 **Total:** $${cartTotals.totalUsd.toFixed(2)} USD\n` +
             `🇻🇪 **Total:** Bs ${cartTotals.totalBs.toFixed(2)}\n\n` +
             `🎯 **¿QUÉ DESEA HACER?**\n` +
             `═══════════════════════════\n` +
             `➕ Agregar más productos\n` +
             `👀 Ver carrito completo\n` +
             `💳 Proceder a comprar\n` +
             `🔍 Buscar otros productos\n\n` +
             `💬 ¡Continúe comprando! 🚀`;
             
    } catch (error) {
      this.logger.error(`Error agregando al carrito: ${error.message}`);
      return `❌ **ERROR AGREGANDO PRODUCTO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 No se pudo agregar al carrito\n` +
             `⏰ Intente nuevamente\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async showCart(session: PersistentSession): Promise<string> {
    try {
      const cartItems = await this.chatService.findActiveCartItems(session.phoneNumber);
      
      if (cartItems.length === 0) {
        return `🛒 **CARRITO VACÍO** 🛒\n` +
               `═══════════════════════════\n` +
               `📭 No tiene productos en el carrito\n\n` +
               `🔍 **¿QUÉ DESEA HACER?**\n` +
               `═══════════════════════════\n` +
               `🛍️ Buscar productos\n` +
               `📂 Ver categorías\n` +
               `💬 Escriba lo que necesita\n\n` +
               `🚀 ¡Comience a llenar su carrito! 🚀`;
      }

      const cartTotals = await this.chatService.getCartTotal(session.phoneNumber);
      
      let respuesta = `🛒 **MI CARRITO DE COMPRAS** 🛒\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `📦 ${cartTotals.itemCount} productos • $${cartTotals.totalUsd.toFixed(2)} USD\n\n`;
      
      cartItems.forEach((item, index) => {
        const subtotal = item.unitPriceUsd * item.quantity;
        const subtotalBs = subtotal * (1 + (item.ivaTax / 100)) * item.exchangeRate;
        
        respuesta += `${index + 1}️⃣ **${item.productName}**\n`;
        respuesta += `   💵 $${Number(item.unitPriceUsd || 0).toFixed(2)} x ${item.quantity} = $${subtotal.toFixed(2)}\n`;
        respuesta += `   🇻🇪 Bs ${subtotalBs.toFixed(2)}\n\n`;
      });
      
      respuesta += `💰 **TOTAL DEL CARRITO:**\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `💵 **USD:** $${cartTotals.totalUsd.toFixed(2)}\n`;
      respuesta += `🇻🇪 **Bolívares:** Bs ${cartTotals.totalBs.toFixed(2)}\n\n`;
      respuesta += `🎯 **ACCIONES DISPONIBLES:**\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `➕ Seguir comprando\n`;
      respuesta += `➖ Quitar producto [número]\n`;
      respuesta += `🗑️ Vaciar carrito\n`;
      respuesta += `💳 Proceder a comprar\n\n`;
      respuesta += `💬 ¡Escriba su próxima acción! 🚀`;
      
      return respuesta;
      
    } catch (error) {
      this.logger.error(`Error mostrando carrito: ${error.message}`);
      return `❌ **ERROR CONSULTANDO CARRITO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error obteniendo información\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async removeProductFromCart(productNumber: number | null, session: PersistentSession): Promise<string> {
    try {
      if (productNumber === null) {
        return `❌ **NÚMERO DE PRODUCTO REQUERIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Especifique qué producto quitar\n` +
               `💡 Ejemplo: "Quitar producto 2"\n` +
               `👀 Use "ver carrito" para ver números\n\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      const cartItems = await this.chatService.findActiveCartItems(session.phoneNumber);
      
      if (cartItems.length === 0) {
        return `🛒 **CARRITO VACÍO** 🛒\n` +
               `═══════════════════════════\n` +
               `📭 No hay productos para quitar\n` +
               `🚀 ¡Comience a agregar productos! 🚀`;
      }

      if (productNumber < 1 || productNumber > cartItems.length) {
        return `❌ **NÚMERO INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Número válido: 1 a ${cartItems.length}\n` +
               `👀 Use "ver carrito" para verificar\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      const itemToRemove = cartItems[productNumber - 1];
      const success = await this.chatService.removeFromCart(session.phoneNumber, itemToRemove.productCode);
      
      if (success) {
        const newTotals = await this.chatService.getCartTotal(session.phoneNumber);
        
        return `✅ **¡PRODUCTO ELIMINADO!** ✅\n` +
               `═══════════════════════════\n` +
               `🗑️ **Producto eliminado:**\n` +
               `🏷️ ${itemToRemove.productName}\n` +
               `💵 $${itemToRemove.unitPriceUsd.toFixed(2)} x ${itemToRemove.quantity}\n\n` +
               `🛒 **CARRITO ACTUALIZADO:**\n` +
               `═══════════════════════════\n` +
               `📊 ${newTotals.itemCount} productos restantes\n` +
               `💰 **Total:** $${newTotals.totalUsd.toFixed(2)} USD\n\n` +
               `🎯 **¿QUÉ DESEA HACER?**\n` +
               `═══════════════════════════\n` +
               `👀 Ver carrito\n` +
               `➕ Seguir comprando\n` +
               `💳 Proceder a comprar\n\n` +
               `💬 ¡Continúe con su compra! 🚀`;
      } else {
        return `❌ **ERROR ELIMINANDO PRODUCTO** ❌\n` +
               `═══════════════════════════\n` +
               `🔧 No se pudo eliminar\n` +
               `🆘 ID: ${Date.now().toString(36)} 🆘`;
      }
      
    } catch (error) {
      this.logger.error(`Error quitando producto del carrito: ${error.message}`);
      return `❌ **ERROR EN ELIMINACIÓN** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando eliminación\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async clearUserCart(session: PersistentSession): Promise<string> {
    try {
      const itemsCount = await this.chatService.clearCart(session.phoneNumber);
      
      if (itemsCount > 0) {
        return `✅ **¡CARRITO VACIADO!** ✅\n` +
               `═══════════════════════════\n` +
               `🗑️ ${itemsCount} productos eliminados\n` +
               `📭 Carrito ahora está vacío\n\n` +
               `🔍 **¿QUÉ DESEA HACER?**\n` +
               `═══════════════════════════\n` +
               `🛍️ Buscar productos\n` +
               `📂 Ver categorías\n` +
               `💬 Escriba lo que necesita\n\n` +
               `🚀 ¡Comience una nueva compra! 🚀`;
      } else {
        return `🛒 **CARRITO YA ESTABA VACÍO** 🛒\n` +
               `═══════════════════════════\n` +
               `📭 No había productos para eliminar\n` +
               `🚀 ¡Comience a agregar productos! 🚀`;
      }
      
    } catch (error) {
      this.logger.error(`Error vaciando carrito: ${error.message}`);
      return `❌ **ERROR VACIANDO CARRITO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error en la operación\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async proceedToCheckout(session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const cartItems = await this.chatService.findActiveCartItems(session.phoneNumber);
      
      if (cartItems.length === 0) {
        return `🛒 **CARRITO VACÍO** 🛒\n` +
               `═══════════════════════════\n` +
               `📭 Agregue productos antes de comprar\n` +
               `🔍 Busque productos para empezar\n` +
               `🚀 ¡Llene su carrito primero! 🚀`;
      }

      const cartTotals = await this.chatService.getCartTotal(session.phoneNumber);
      
      // Cambiar contexto a checkout
      session.context = 'checkout_payment_selection';
      await this.chatService.saveSession(session);
      
      return `💳 **¡SELECCIONE MÉTODO DE PAGO!** 💳\n` +
             `═══════════════════════════\n` +
             `🛒 ${cartTotals.itemCount} productos en carrito\n` +
             `💰 **Total:** $${cartTotals.totalUsd.toFixed(2)} USD\n` +
             `🇻🇪 **Total:** Bs ${cartTotals.totalBs.toFixed(2)}\n\n` +
             `💳 **MÉTODOS DE PAGO DISPONIBLES:**\n` +
             `═══════════════════════════\n` +
             `1️⃣ 📱 **PAGO MÓVIL** (Bolívares)\n` +
             `2️⃣ 💳 **ZELLE** (USD)\n` +
             `3️⃣ 🏦 **TRANSFERENCIA USD**\n` +
             `4️⃣ 💵 **EFECTIVO BOLÍVARES**\n` +
             `5️⃣ 🏧 **PUNTO DE VENTA**\n` +
             `6️⃣ 💰 **EFECTIVO USD**\n\n` +
             `📝 **¿CÓMO PROCEDER?**\n` +
             `═══════════════════════════\n` +
             `🔢 Escriba el número del método (1-6)\n` +
             `🔄 O escriba "cancelar" para volver\n` +
             `💬 Ejemplo: "1" para Pago Móvil`;
             
    } catch (error) {
      this.logger.error(`Error en checkout: ${error.message}`);
      return `❌ **ERROR EN CHECKOUT** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando compra\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar selección de método de pago
   */
  private async handlePaymentSelection(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const metodo = parseInt(message.trim());
      
      if (isNaN(metodo) || metodo < 1 || metodo > 6) {
        return `❌ **MÉTODO INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Seleccione un número del 1 al 6\n` +
               `💡 Ejemplo: escriba "2" para Zelle\n\n` +
               `💳 **MÉTODOS DISPONIBLES:**\n` +
               `═══════════════════════════\n` +
               `1️⃣ Pago Móvil | 2️⃣ Zelle\n` +
               `3️⃣ Transferencia USD | 4️⃣ Efectivo Bs\n` +
               `5️⃣ Punto de Venta | 6️⃣ Efectivo USD`;
      }

      // Si es Pago Móvil (opción 1), activar flujo de validación
      if (metodo === 1) {
        // Obtener lista de bancos
        const bancos = await this.valeryDbService.obtenerBancos();
        
        if (!bancos || bancos.length === 0) {
          return `❌ **ERROR EN SISTEMA BANCARIO** ❌\n` +
                 `═══════════════════════════\n` +
                 `🏦 No se pueden obtener bancos\n` +
                 `⏰ Intente más tarde\n` +
                 `📞 O contacte servicio al cliente`;
        }

        // Cambiar contexto para selección de banco
        session.context = 'payment_bank_selection';
        await this.chatService.saveSession(session);

        let respuesta = `🏦 **SELECCIONE SU BANCO** 🏦\n`;
        respuesta += `═══════════════════════════\n`;
        respuesta += `📱 Ha seleccionado: **PAGO MÓVIL**\n`;
        respuesta += `💰 Moneda: **BOLÍVARES**\n\n`;
        respuesta += `🏦 **BANCOS DISPONIBLES:**\n`;
        respuesta += `═══════════════════════════\n`;

        for (const banco of bancos) {
          respuesta += `🔹 **${banco.codigo}** - ${banco.banco}\n`;
        }

        respuesta += `\n💡 **¿CÓMO SELECCIONAR?**\n`;
        respuesta += `═══════════════════════════\n`;
        respuesta += `🔢 Escriba el código de 4 dígitos\n`;
        respuesta += `💡 Ejemplo: 0102, 0134, 0151\n\n`;
        respuesta += `🔄 Escriba "cancelar" para volver`;

        return respuesta;
      }

      // Para otros métodos, usar el flujo original
      const resultado = await this.createOrderFromCart(session.phoneNumber, metodo);
      
      if (resultado.success) {
        // Limpiar carrito después de crear pedido exitoso
        await this.chatService.clearCart(session.phoneNumber);
        
        // Cambiar contexto de vuelta al menú
        session.context = 'menu';
        await this.chatService.saveSession(session);
        
        const metodosTexto = {
          1: '📱 PAGO MÓVIL',
          2: '💳 ZELLE',
          3: '🏦 TRANSFERENCIA USD',
          4: '💵 EFECTIVO BOLÍVARES',
          5: '🏧 PUNTO DE VENTA',
          6: '💰 EFECTIVO USD'
        };
        
        return `🎉 **¡PEDIDO CREADO EXITOSAMENTE!** 🎉\n` +
               `═══════════════════════════\n` +
               `✅ **ID Pedido:** ${resultado.idencabedoc}\n` +
               `💳 **Método:** ${metodosTexto[metodo]}\n` +
               `💰 **Total:** $${resultado.detalles.total.toFixed(2)} ${resultado.detalles.moneda}\n` +
               `📦 **Productos:** ${resultado.detalles.productos} items\n\n` +
               `📋 **INFORMACIÓN IMPORTANTE:**\n` +
               `═══════════════════════════\n` +
               `📞 Contacto para coordinar entrega\n` +
               `💳 Datos de pago serán enviados\n` +
               `📦 Preparación: 24-48 horas\n` +
               `🚚 Entrega según ubicación\n\n` +
               `🎯 **¿QUÉ DESEA HACER AHORA?**\n` +
               `═══════════════════════════\n` +
               `🔍 Buscar más productos\n` +
               `📄 Ver historial de pedidos\n` +
               `💬 Escriba lo que necesita\n\n` +
               `🚀 ¡Gracias por su compra! 🚀`;
      } else {
        return `❌ **ERROR AL CREAR PEDIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔧 ${resultado.error}\n` +
               `⏰ Intente nuevamente\n` +
               `📞 O contacte servicio al cliente\n` +
               `🆘 ID: ${Date.now().toString(36)} 🆘`;
      }
      
    } catch (error) {
      this.logger.error(`Error en selección de pago: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando método de pago\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Crear pedido desde carrito de compras
   */
  private async createOrderFromCart(phoneNumber: string, metodoPago: number): Promise<any> {
    try {
      // Convertir carrito a formato de pedido
      const datosCarrito = await this.valeryDbService.convertirCarritoAPedido(phoneNumber, metodoPago);
      
      // Crear pedido usando el sistema completo
      const resultado = await this.valeryDbService.crearPedidoCompleto(datosCarrito);
      
      this.logger.log(`✅ Pedido creado desde carrito: ${resultado.idencabedoc} para ${phoneNumber}`);
      
      return resultado;
      
    } catch (error) {
      this.logger.error(`Error creando pedido desde carrito: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Detectar si el mensaje es una lista de productos
   */
  private esListaProductos(message: string): boolean {
    // Buscar indicadores de lista: comas, saltos de línea, múltiples productos
    const indicadoresLista = [
      /,.*,/,  // Múltiples comas
      /\n.*\n/, // Múltiples líneas
      /;.*;/, // Múltiples punto y coma
      /lista de/i,
      /necesito.*,/i,
      /quiero.*,/i
    ];

    return indicadoresLista.some(patron => patron.test(message)) || 
           message.split(/[,\n;]/).length > 2;
  }

  /**
   * Manejar búsqueda de productos por lista
   */
  private async handleProductListSearch(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const resultados = await this.valeryDbService.buscarProductosPorLista(message);
      
      // Verificar si resultados es el objeto estructurado esperado
      if (!resultados || Array.isArray(resultados)) {
        return `😔 **¡NO ENCONTRAMOS PRODUCTOS DE SU LISTA!** 😔\n` +
               `═══════════════════════════\n` +
               `📝 Lista analizada\n` +
               `❌ Sin resultados disponibles\n\n` +
               `💡 **SUGERENCIAS:**\n` +
               `═══════════════════════════\n` +
               `🔄 Revise la ortografía\n` +
               `📝 Use nombres más específicos\n` +
               `💬 Busque productos individuales\n\n` +
               `🚀 ¡Intente con otra lista! 🚀`;
      }

      const productos = resultados.productos || [];
      const terminos = resultados.terminos || [];
      const estadisticas = resultados.estadisticas || { terminosBuscados: 0, productosEncontrados: 0, promedioPorTermino: 0 };
      
      if (!productos || productos.length === 0) {
        return `😔 **¡NO ENCONTRAMOS PRODUCTOS DE SU LISTA!** 😔\n` +
               `═══════════════════════════\n` +
               `📝 Lista analizada: ${terminos.join(', ')}\n` +
               `❌ Sin resultados disponibles\n\n` +
               `💡 **SUGERENCIAS:**\n` +
               `═══════════════════════════\n` +
               `🔄 Revise la ortografía\n` +
               `📝 Use nombres más específicos\n` +
               `💬 Busque productos individuales\n\n` +
               `🚀 ¡Intente con otra lista! 🚀`;
      }

      let respuesta = `🛍️ **¡PRODUCTOS DE SU LISTA ENCONTRADOS!** 🛍️\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `📋 Términos buscados: ${estadisticas.terminosBuscados}\n`;
      respuesta += `📦 Productos encontrados: ${estadisticas.productosEncontrados}\n`;
      respuesta += `📊 Promedio por término: ${estadisticas.promedioPorTermino}\n\n`;

      for (let i = 0; i < Math.min(productos.length, 15); i++) {
        const p = productos[i];
        if (!p.nombre || !p.preciounidad || !p.tasa_actual) continue;

        const precioUSD = (parseFloat(p.preciounidad) || 0).toFixed(2);
        const precioBs = this.calcularPrecioBs(p.preciounidad, p.alicuotaiva, p.tasa_actual).toFixed(2);

        respuesta += `🏷️ **PRODUCTO ${i + 1}** 🏷️\n`;
        respuesta += `📌 **${p.nombre}**\n`;
        respuesta += `💵 **USD:** $${precioUSD}\n`;
        respuesta += `🇻🇪 **Bolívares:** Bs ${precioBs}\n`;
        respuesta += `📦 **Stock:** ${p.existenciaunidad} unidades\n\n`;
      }

      if (productos.length > 15) {
        respuesta += `... y ${productos.length - 15} productos más.\n\n`;
      }

      respuesta += `🛒 **¿CÓMO AGREGAR AL CARRITO?** 🛒\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `✅ "Agregar [número] al carrito"\n`;
      respuesta += `✅ "Quiero el producto [número]"\n\n`;
      respuesta += `🔍 **¿Desea refinar su lista?** 🔍\n`;
      respuesta += `💬 ¡Escriba una nueva lista o elija productos! 🚀`;

      return respuesta;

    } catch (error) {
      this.logger.error(`Error en búsqueda por lista: ${error.message}`);
      return `❌ **ERROR EN BÚSQUEDA POR LISTA** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando su lista\n` +
             `⏰ Intente nuevamente\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar selección de banco para pago móvil
   */
  private async handleBankSelection(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const codigoBanco = message.trim();
      
      // Validar que sea un código de banco válido (4 dígitos)
      if (!/^\d{4}$/.test(codigoBanco)) {
        return `❌ **CÓDIGO DE BANCO INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Debe ser exactamente 4 dígitos\n` +
               `💡 Ejemplo: 0102, 0134, 0151\n` +
               `📋 Revise la lista de bancos\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      // Buscar el banco en la base de datos
      const bancos = await this.valeryDbService.obtenerBancos();
      const bancoSeleccionado = bancos.find(b => b.codigo === codigoBanco);

      if (!bancoSeleccionado) {
        return `❌ **BANCO NO ENCONTRADO** ❌\n` +
               `═══════════════════════════\n` +
               `🏦 Código ${codigoBanco} no válido\n` +
               `📋 Revise la lista de bancos disponibles\n` +
               `🔄 ¡Intente con otro código! 🔄`;
      }

      // Guardar selección en metadata
      session.metadata = {
        ...session.metadata,
        pagoMovil: {
          ...session.metadata?.pagoMovil,
          codigoBanco: codigoBanco,
          nombreBanco: bancoSeleccionado.banco
        }
      };

      // Cambiar contexto para solicitar número de teléfono emisor
      session.context = 'payment_phone_input';
      await this.chatService.saveSession(session);

      return `✅ **BANCO SELECCIONADO** ✅\n` +
             `═══════════════════════════\n` +
             `🏦 **Banco:** ${bancoSeleccionado.banco}\n` +
             `🔢 **Código:** ${codigoBanco}\n\n` +
             `📱 **SIGUIENTE PASO** 📱\n` +
             `═══════════════════════════\n` +
             `📞 Ingrese el número de teléfono\n` +
             `📲 desde el cual realizó el pago\n` +
             `💡 Ejemplo: 04141234567\n\n` +
             `🔄 Escriba "cancelar" para volver`;

    } catch (error) {
      this.logger.error(`Error en selección de banco: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando banco\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar entrada de número de teléfono emisor
   */
  private async handlePaymentPhoneInput(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      if (message.toLowerCase().includes('cancelar')) {
        session.context = 'menu';
        await this.chatService.saveSession(session);
        return `🔄 **PAGO CANCELADO** 🔄\n` +
               `═══════════════════════════\n` +
               `↩️ Regresando al menú principal\n` +
               `💬 ¿En qué más puedo ayudarle?`;
      }

      const telefono = message.replace(/\D/g, ''); // Solo números

      // Validar formato de teléfono venezolano
      if (!/^(0414|0424|0412|0416|0426)\d{7}$/.test(telefono) && !/^(414|424|412|416|426)\d{7}$/.test(telefono)) {
        return `❌ **NÚMERO DE TELÉFONO INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `📱 Debe ser un número móvil venezolano\n` +
               `💡 Ejemplos válidos:\n` +
               `   📞 04141234567\n` +
               `   📞 04241234567\n` +
               `   📞 04121234567\n\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      // Normalizar teléfono
      const telefonoNormalizado = telefono.startsWith('0') ? telefono : `0${telefono}`;

      // Guardar en metadata
      session.metadata = {
        ...session.metadata,
        pagoMovil: {
          ...session.metadata?.pagoMovil,
          telefonoEmisor: telefonoNormalizado
        }
      };

      // Cambiar contexto para solicitar cédula
      session.context = 'payment_cedula_input';
      await this.chatService.saveSession(session);

      return `✅ **TELÉFONO REGISTRADO** ✅\n` +
             `═══════════════════════════\n` +
             `📱 **Teléfono:** ${telefonoNormalizado}\n\n` +
             `🆔 **SIGUIENTE PASO** 🆔\n` +
             `═══════════════════════════\n` +
             `📝 Ingrese la cédula de identidad\n` +
             `👤 de la persona que realizó el pago\n` +
             `💡 Ejemplo: V12345678 o 12345678\n\n` +
             `🔄 Escriba "cancelar" para volver`;

    } catch (error) {
      this.logger.error(`Error en entrada de teléfono: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando teléfono\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar entrada de cédula del pagador
   */
  private async handlePaymentCedulaInput(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      if (message.toLowerCase().includes('cancelar')) {
        session.context = 'menu';
        await this.chatService.saveSession(session);
        return `🔄 **PAGO CANCELADO** 🔄\n` +
               `═══════════════════════════\n` +
               `↩️ Regresando al menú principal\n` +
               `💬 ¿En qué más puedo ayudarle?`;
      }

      // Normalizar cédula
      let cedula = message.replace(/\D/g, '');
      const prefijo = message.toUpperCase().match(/^[VEJP]/)?.[0] || 'V';
      
      // Validar longitud de cédula
      if (cedula.length < 6 || cedula.length > 9) {
        return `❌ **CÉDULA INVÁLIDA** ❌\n` +
               `═══════════════════════════\n` +
               `🆔 Debe tener entre 6 y 9 dígitos\n` +
               `💡 Ejemplos válidos:\n` +
               `   📝 V12345678\n` +
               `   📝 12345678\n` +
               `   📝 J123456789\n\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      const cedulaCompleta = `${prefijo}${cedula}`;

      // Validar que el cliente existe en la base de datos
      const clienteValido = await this.valeryDbService.validarCliente(cedula);

      // Guardar en metadata
      session.metadata = {
        ...session.metadata,
        pagoMovil: {
          ...session.metadata?.pagoMovil,
          cedulaPagador: cedulaCompleta,
          clienteValidado: !!clienteValido
        }
      };

      // Cambiar contexto para solicitar referencia
      session.context = 'payment_reference_input';
      await this.chatService.saveSession(session);

      let respuesta = `✅ **CÉDULA REGISTRADA** ✅\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `🆔 **Cédula:** ${cedulaCompleta}\n`;
      
      if (clienteValido) {
        respuesta += `👤 **Cliente:** ${clienteValido.nombre}\n`;
        respuesta += `✅ **Cliente verificado en sistema**\n\n`;
      } else {
        respuesta += `⚠️ **Cliente no encontrado en sistema**\n`;
        respuesta += `📝 Se registrará como nuevo cliente\n\n`;
      }

      respuesta += `🔢 **ÚLTIMO PASO** 🔢\n`;
      respuesta += `═══════════════════════════\n`;
      respuesta += `💳 Ingrese los últimos 4 dígitos\n`;
      respuesta += `📋 de la referencia del pago\n`;
      respuesta += `💡 Ejemplo: 1234\n\n`;
      respuesta += `🔄 Escriba "cancelar" para volver`;

      return respuesta;

    } catch (error) {
      this.logger.error(`Error en entrada de cédula: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando cédula\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar entrada de referencia de pago
   */
  private async handlePaymentReferenceInput(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      if (message.toLowerCase().includes('cancelar')) {
        session.context = 'menu';
        await this.chatService.saveSession(session);
        return `🔄 **PAGO CANCELADO** 🔄\n` +
               `═══════════════════════════\n` +
               `↩️ Regresando al menú principal\n` +
               `💬 ¿En qué más puedo ayudarle?`;
      }

      const referencia = message.replace(/\D/g, ''); // Solo números

      // Validar que sean exactamente 4 dígitos
      if (!/^\d{4}$/.test(referencia)) {
        return `❌ **REFERENCIA INVÁLIDA** ❌\n` +
               `═══════════════════════════\n` +
               `🔢 Debe ingresar exactamente 4 dígitos\n` +
               `💡 Ejemplo: 1234\n` +
               `📋 Revise el comprobante de pago\n` +
               `🔄 ¡Intente nuevamente! 🔄`;
      }

      // Completar datos de pago y crear el pedido
      const pagoMovilData = session.metadata?.pagoMovil;
      
      if (!pagoMovilData?.codigoBanco || !pagoMovilData?.telefonoEmisor || !pagoMovilData?.cedulaPagador) {
        return `❌ **ERROR EN DATOS DE PAGO** ❌\n` +
               `═══════════════════════════\n` +
               `🔧 Faltan datos del proceso\n` +
               `🔄 Debe reiniciar el proceso de pago\n` +
               `💬 Seleccione método de pago nuevamente`;
      }

      // Crear el pedido
      const cartTotals = await this.chatService.getCartTotal(session.phoneNumber);
      const resultadoPedido = await this.createOrderFromCart(session.phoneNumber, 1); // 1 = Pago Móvil

      if (!resultadoPedido.success) {
        return `❌ **ERROR AL CREAR PEDIDO** ❌\n` +
               `═══════════════════════════\n` +
               `🔧 ${resultadoPedido.error}\n` +
               `⏰ Intente nuevamente\n` +
               `🆘 ID: ${Date.now().toString(36)} 🆘`;
      }

      // Registrar información completa del pago
      await this.valeryDbService.registrarInformacionPago({
        idencabedoc: resultadoPedido.idencabedoc,
        idtipo: 1, // Pago Móvil
        monto: cartTotals.totalBs, // En bolívares para pago móvil
        codigobanco: parseInt(pagoMovilData.codigoBanco),
        banco: pagoMovilData.nombreBanco,
        clienteid: pagoMovilData.cedulaPagador,
        telefono: pagoMovilData.telefonoEmisor,
        nroreferencia: referencia
      });

      // Limpiar carrito y resetear contexto
      await this.chatService.clearCart(session.phoneNumber);
      session.context = 'menu';
      session.metadata = {
        ...session.metadata,
        pagoMovil: undefined
      };
      await this.chatService.saveSession(session);

      return `🎉 **¡PEDIDO CREADO CON PAGO MÓVIL!** 🎉\n` +
             `═══════════════════════════\n` +
             `✅ **ID Pedido:** ${resultadoPedido.idencabedoc}\n` +
             `🏦 **Banco:** ${pagoMovilData.nombreBanco} (${pagoMovilData.codigoBanco})\n` +
             `📱 **Teléfono:** ${pagoMovilData.telefonoEmisor}\n` +
             `🆔 **Cédula:** ${pagoMovilData.cedulaPagador}\n` +
             `🔢 **Ref:** ****${referencia}\n` +
             `💰 **Total:** Bs ${cartTotals.totalBs.toFixed(2)}\n\n` +
             `📋 **INFORMACIÓN IMPORTANTE:**\n` +
             `═══════════════════════════\n` +
             `⏳ Su pago será validado en tiempo real\n` +
             `📞 Recibirá confirmación por WhatsApp\n` +
             `🚚 Preparación: 24-48 horas\n` +
             `📦 Se le notificará cuando esté listo\n\n` +
             `🎯 **¿QUÉ DESEA HACER AHORA?**\n` +
             `═══════════════════════════\n` +
             `🔍 Buscar más productos\n` +
             `📄 Ver historial de pedidos\n` +
             `💬 Escriba lo que necesita\n\n` +
             `🚀 ¡Gracias por su compra! 🚀`;

    } catch (error) {
      this.logger.error(`Error en entrada de referencia: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error procesando referencia\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  /**
   * Manejar registro de cliente nuevo (restaurando método original)
   */
  private async handleNewClientRegistration(message: string, session: PersistentSession, chatbotId: string): Promise<string> {
    try {
      const nombreCompleto = message.trim();
      
      // Validar que el nombre tenga al menos 2 palabras
      const palabras = nombreCompleto.split(' ').filter(palabra => palabra.length > 0);
      if (palabras.length < 2) {
        return `❌ **NOMBRE INCOMPLETO** ❌\n` +
               `═══════════════════════════\n` +
               `📝 Necesito su nombre Y apellido completo\n` +
               `💡 Ejemplo: "Juan Carlos Pérez González"\n\n` +
               `🔄 **Por favor, intente nuevamente:**\n` +
               `═══════════════════════════\n` +
               `👤 Escriba su nombre completo\n` +
               `✨ ¡Estamos a un paso de terminar! ✨`;
      }
      
      // Validar que no tenga caracteres especiales raros
      if (!/^[a-zA-ZÀ-ÿñÑ\s]+$/.test(nombreCompleto)) {
        return `❌ **FORMATO DE NOMBRE INVÁLIDO** ❌\n` +
               `═══════════════════════════\n` +
               `📝 Solo se permiten letras y espacios\n` +
               `🚫 Sin números ni símbolos especiales\n\n` +
               `💡 **Ejemplo correcto:**\n` +
               `═══════════════════════════\n` +
               `👤 "Juan Carlos Pérez González"\n` +
               `🔄 Intente nuevamente por favor 🔄`;
      }

      // Crear el nuevo cliente en la base de datos externa
      const nuevoCliente = await this.createNewClient(nombreCompleto, session.identificationNumber, session.phoneNumber);

      if (nuevoCliente.success) {
        // Actualizar sesión con información del cliente registrado
        session.clientId = nuevoCliente.codigocliente;
        session.clientName = nombreCompleto;
        session.isAuthenticated = true;
        session.isNewClient = false;
        session.context = 'menu';
        
        await this.chatService.saveSession(session);
        
        return `🎊 **¡REGISTRO EXITOSO!** 🎊\n` +
               `═══════════════════════════\n` +
               `✅ **¡Bienvenido ${nombreCompleto}!** ✅\n` +
               `🆕 Cliente registrado: ${nuevoCliente.codigocliente}\n` +
               `🎁 ¡Cuenta creada exitosamente!\n\n` +
               `🌟 **¡OFERTAS DE BIENVENIDA!** 🌟\n` +
               `═══════════════════════════\n` +
               `🎯 Productos con descuentos especiales\n` +
               `🚀 Servicio personalizado garantizado\n` +
               `💎 Experiencia premium desde el primer día\n\n` +
               `🎯 **¿CÓMO LE PUEDO AYUDAR?** 🎯\n` +
               `═══════════════════════════\n\n` +
               `1️⃣ 🔍 **Consultar productos** → Ver catálogo\n` +
               `2️⃣ 💰 **Ver mi saldo** → Estado cuenta\n` +
               `3️⃣ 📄 **Historial facturas** → Mis compras\n` +
               `4️⃣ 🛒 **Hacer un pedido** → ¡Primera compra!\n\n` +
               `💬 O escriba directamente lo que necesita... 🚀`;
      } else {
        return `❌ **ERROR EN EL REGISTRO** ❌\n` +
               `═══════════════════════════\n` +
               `🔧 No se pudo crear la cuenta\n` +
               `⚠️ Error: ${nuevoCliente.error}\n\n` +
               `🔄 **¿QUÉ PUEDE HACER?**\n` +
               `═══════════════════════════\n` +
               `⏰ Intente nuevamente\n` +
               `📞 Contacte servicio al cliente\n` +
               `🆘 ID: ${Date.now().toString(36)} 🆘`;
      }
      
    } catch (error) {
      this.logger.error(`Error en registro de cliente: ${error.message}`);
      return `❌ **ERROR TÉCNICO** ❌\n` +
             `═══════════════════════════\n` +
             `🔧 Error durante el registro\n` +
             `⏰ Intente más tarde\n` +
             `🆘 ID: ${Date.now().toString(36)} 🆘`;
    }
  }

  private async createNewClient(nombreCompleto: string, cedula: string, telefono: string): Promise<any> {
    try {
      // Obtener el próximo ID disponible
      const maxIdQuery = `SELECT COALESCE(MAX(idcliente), 0) + 1 as next_id FROM clientes`;
      const maxIdResult = await this.valeryDbService.ejecutarQuery(maxIdQuery);
      const nextId = maxIdResult[0]?.next_id || 1;
      
      // Preparar datos del nuevo cliente
      const codigoCliente = cedula; // Usar la cédula como código de cliente
      const rifFormateado = cedula.startsWith('V') || cedula.startsWith('J') || cedula.startsWith('E') || cedula.startsWith('P') 
        ? cedula 
        : `V${cedula}`;
      
      const insertQuery = `
        INSERT INTO clientes (
          idcliente, 
          codigocliente, 
          nombre, 
          rif, 
          direccion1, 
          direccion2, 
          idpais, 
          idestado, 
          idciudad, 
          idmunicipio, 
          codigopostal, 
          telefono1, 
          telefono2, 
          email, 
          tienecredito, 
          esexento, 
          diascredito, 
          saldo, 
          pagos, 
          fechaultimaventa, 
          fechacreacion, 
          fechacredito, 
          esagentederetencion, 
          redsocial1, 
          redsocial2, 
          redsocial3, 
          status, 
          coordenadas
        ) VALUES (
          $1, $2, $3, $4, '', '', 1, 1, 1, 1, '', 
          $5, '', '', 0, 0, 0, '0', '0', 
          NULL, NOW(), NOW(), 0, 
          NULL, NULL, NULL, '1', '10.5100, -66.9100'
        )
        RETURNING idcliente, codigocliente
      `;
      
      const params = [
        nextId,
        codigoCliente,
        nombreCompleto.toUpperCase(),
        rifFormateado,
        telefono
      ];
      
      const result = await this.valeryDbService.ejecutarQuery(insertQuery, params);
      
      if (result && result.length > 0) {
        this.logger.log(`✅ Cliente creado exitosamente: ${codigoCliente} - ${nombreCompleto}`);
        return {
          success: true,
          codigocliente: codigoCliente,
          idcliente: result[0].idcliente
        };
      } else {
        return {
          success: false,
          error: 'No se pudo insertar el registro'
        };
      }
      
    } catch (error) {
      this.logger.error(`Error creando cliente: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
