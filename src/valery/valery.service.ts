import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { ValeryDbService } from './valery-db.service';

@Injectable()
export class ValeryService {
  private readonly logger = new Logger(ValeryService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Product, 'users')
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Invoice, 'users')
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(User, 'users')
    private readonly userRepository: Repository<User>,
    private valeryDbService: ValeryDbService
  ) {
    this.apiUrl = this.configService.get<string>('VALERY_API_URL');
    this.apiKey = this.configService.get<string>('VALERY_API_KEY');
  }

  async sincronizarProductos() {
    try {
      const response = await axios.get(`${this.apiUrl}/productos`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      for (const producto of response.data) {
        await this.productRepository.save({
          codigoValery: producto.codigo,
          nombre: producto.nombre,
          descripcion: producto.descripcion,
          precio: producto.precio,
          precioIva: producto.precio_iva,
          precioNeto: producto.precio_neto,
          codigoIva: producto.codigo_iva,
          ultimaSincronizacion: new Date(),
          activo: true
        });
      }

      this.logger.log('Sincronización de productos completada');
    } catch (error) {
      this.logger.error('Error al sincronizar productos:', error);
      throw error;
    }
  }

  async sincronizarFacturas() {
    try {
      const response = await axios.get(`${this.apiUrl}/facturas`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      for (const factura of response.data) {
        await this.invoiceRepository.save({
          numeroFactura: factura.numero,
          codigoValery: factura.codigo,
          clienteId: factura.cliente_id,
          subtotal: factura.subtotal,
          iva: factura.iva,
          total: factura.total,
          estadoFactura: factura.estado,
          metodoPago: factura.metodo_pago,
          fechaEmision: new Date(factura.fecha_emision),
          ultimaSincronizacion: new Date()
        });
      }

      this.logger.log('Sincronización de facturas completada');
    } catch (error) {
      this.logger.error('Error al sincronizar facturas:', error);
      throw error;
    }
  }

  async sincronizarClientes() {
    try {
      const response = await axios.get(`${this.apiUrl}/clientes`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` }
      });

      for (const cliente of response.data) {
        await this.userRepository.save({
          codigoCliente: cliente.codigo,
          nombre: cliente.nombre,
          rif: cliente.rif,
          direccion1: cliente.direccion,
          telefono1: cliente.telefono,
          email: cliente.email,
          tieneCredito: cliente.tiene_credito ? 1 : 0,
          diasCredito: cliente.dias_credito
        });
      }

      this.logger.log('Sincronización de clientes completada');
    } catch (error) {
      this.logger.error('Error al sincronizar clientes:', error);
      throw error;
    }
  }

  async procesarMensaje(mensaje: string, chatbotId: string, clienteId?: string): Promise<string> {
    try {
      this.logger.debug(`Procesando mensaje para chatbot ${chatbotId}: ${mensaje}`);
      
      // Si el mensaje parece ser una búsqueda de producto
      if (this.esConsultaProducto(mensaje)) {
        return this.buscarProductos(mensaje);
      }
      
      // Si el mensaje parece ser una consulta de saldo
      if (this.esConsultaSaldo(mensaje) && clienteId) {
        return this.consultarSaldo(clienteId);
      }
      
      // Si el mensaje parece ser una solicitud de factura
      if (this.esConsultaFactura(mensaje) && clienteId) {
        return this.consultarFacturas(clienteId);
      }
      
      // Respuesta por defecto
      return this.generarRespuestaPorDefecto(mensaje);
    } catch (error) {
      this.logger.error(`Error al procesar mensaje: ${error}`);
      return "Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente más tarde.";
    }
  }

  private esConsultaProducto(mensaje: string): boolean {
    const patronesProducto = [
      // Patrones básicos de consulta
      /buscar/i, /producto/i, /artículo/i, /precio/i, /costo/i, /valor/i,
      /cuánto cuesta/i, /disponible/i, /stock/i, /inventario/i, /hay/i,
      
      // Patrones de pregunta directa
      /tienes/i, /tienen/i, /tendrás/i, /tendras/i, /habrá/i, /habra/i, 
      /ay/i, /venden/i, /vendes/i, /vende/i,
      
      // Solicitudes y peticiones
      /quiero/i, /necesito/i, /quisiera/i, /dame/i, /me das/i, /me darías/i, /me darias/i,
      /me puedes dar/i, /me puede dar/i, /me podría dar/i, /me podria dar/i,
      
      // Consultas sobre existencia
      /tienen existencia/i, /hay existencia/i, /tienen disponible/i, /hay disponible/i
    ];
    
    return patronesProducto.some(patron => patron.test(mensaje));
  }
  
  private esConsultaSaldo(mensaje: string): boolean {
    const patronesSaldo = [
      /saldo/i, /deuda/i, /debo/i, /pendiente/i, /pagar/i, /cuenta/i, /crédito/i
    ];
    
    return patronesSaldo.some(patron => patron.test(mensaje));
  }
  
  private esConsultaFactura(mensaje: string): boolean {
    const patronesFactura = [
      /factura/i, /recibo/i, /comprobante/i, /historial/i, /compra/i, /pedido/i
    ];
    
    return patronesFactura.some(patron => patron.test(mensaje));
  }

  async buscarProductos(consulta: string): Promise<string> {
    try {
      // Lista ampliada de palabras y expresiones comunes a ignorar en las búsquedas
      const palabrasAIgnorar = [
        // Palabras de pregunta/consulta
        'buscar', 'producto', 'precio', 'de', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 
        // Expresiones comunes de solicitud
        'hay', 'tienen', 'venden', 'tienes', 'tendras', 'tendrás', 'ay', 'habrá', 'habra',
        // Verbos comunes
        'quiero', 'necesito', 'quisiera', 'dame', 'me', 'puedes', 'podrias', 'podrías', 'dar',
        // Frases comunes
        'me puedes', 'me podrias', 'me podrías', 'me das', 'me darías', 'me darias', 
        'necesito que', 'quisiera que', 'por favor', 'porfavor', 'porfa',
        // Artículos y preposiciones adicionales
        'del', 'al', 'con', 'sin', 'para', 'por', 'en', 'a'
      ];
      
      // Normalizar texto: convertir a minúsculas y eliminar caracteres especiales
      const consultaNormalizada = consulta.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
        .replace(/[^\w\s]/gi, ' '); // Reemplazar caracteres especiales por espacios
      
      // Tokenizar y filtrar palabras a ignorar
      const terminoBusqueda = consultaNormalizada
        .split(/\s+/) // Dividir por uno o más espacios
        .filter(palabra => {
          // Mantener solo palabras que no están en la lista de ignoradas y tienen al menos 2 caracteres
          return !palabrasAIgnorar.includes(palabra.toLowerCase()) && palabra.length >= 2;
        })
        .join(' ')
        .trim();
      
      if (!terminoBusqueda) {
        return "Por favor, especifica qué producto estás buscando.";
      }
      
      // Buscar productos usando el servicio de base de datos
      const productos = await this.valeryDbService.obtenerProductos(terminoBusqueda);
      
      if (!productos || productos.length === 0) {
        return `Lo siento, no encontramos productos que coincidan con "${terminoBusqueda}". ¿Quieres buscar con otro nombre?`;
      }
      
      // Limitar resultados
      const productosLimitados = productos.slice(0, 5);
      let respuesta = `Encontramos ${productos.length} productos relacionados con "${terminoBusqueda}":\n\n`;
      
      productosLimitados.forEach((producto, index) => {
        respuesta += `${index + 1}. *${producto.nombre}*\n`;
        respuesta += `   Precio: ${this.formatearPrecio(producto.preciounidad)}\n`;
        respuesta += `   Disponible: ${producto.existenciaunidad} unidades\n\n`;
      });
      
      if (productos.length > 5) {
        respuesta += `... y ${productos.length - 5} productos más. Por favor, especifica más tu búsqueda para ver resultados más precisos.`;
      }
      
      return respuesta;
    } catch (error) {
      this.logger.error(`Error al buscar productos: ${error}`);
      return "Lo siento, ocurrió un error al buscar productos. Por favor, intenta más tarde.";
    }
  }

  async consultarSaldo(clienteId: string): Promise<string> {
    try {
      // Obtener información del cliente
      const cliente = await this.valeryDbService.obtenerClientePorTelefono(clienteId);
      
      if (!cliente) {
        return "No encontramos información asociada a tu número. Por favor, regístrate como cliente.";
      }
      
      if (!cliente.tienecredito) {
        return `Hola ${cliente.nombre}, no tienes una línea de crédito activa.`;
      }
      
      return `Hola ${cliente.nombre}, tu saldo actual es de ${this.formatearPrecio(cliente.saldo)}. Tienes un crédito a ${cliente.diascredito} días.`;
    } catch (error) {
      this.logger.error(`Error al consultar saldo: ${error}`);
      return "Lo siento, no pudimos consultar tu saldo en este momento. Por favor, intenta más tarde.";
    }
  }

  async consultarFacturas(clienteId: string): Promise<string> {
    try {
      // Obtener información del cliente
      const cliente = await this.valeryDbService.obtenerClientePorTelefono(clienteId);
      
      if (!cliente) {
        return "No encontramos información asociada a tu número. Por favor, regístrate como cliente.";
      }
      
      // Obtener facturas recientes
      const facturas = await this.valeryDbService.obtenerFacturasCliente(cliente.codigocliente);
      
      if (!facturas || facturas.length === 0) {
        return `Hola ${cliente.nombre}, no encontramos facturas recientes asociadas a tu cuenta.`;
      }
      
      let respuesta = `Hola ${cliente.nombre}, estas son tus facturas recientes:\n\n`;
      
      facturas.forEach((factura, index) => {
        respuesta += `${index + 1}. Factura #${factura.numero_factura}\n`;
        respuesta += `   Fecha: ${new Date(factura.fecha_emision).toLocaleDateString()}\n`;
        respuesta += `   Total: ${this.formatearPrecio(factura.total)}\n`;
        respuesta += `   Estado: ${this.traducirEstadoFactura(factura.estado)}\n\n`;
      });
      
      return respuesta;
    } catch (error) {
      this.logger.error(`Error al consultar facturas: ${error}`);
      return "Lo siento, no pudimos consultar tus facturas en este momento. Por favor, intenta más tarde.";
    }
  }

  private formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-VE', { style: 'currency', currency: 'USD' }).format(precio);
  }
  
  private traducirEstadoFactura(estado: string): string {
    const estados = {
      'PAID': 'Pagada',
      'PENDING': 'Pendiente',
      'CANCELLED': 'Cancelada',
      'PARTIAL': 'Pago parcial'
    };
    
    return estados[estado] || estado;
  }

  private generarRespuestaPorDefecto(mensaje: string): string {
    const respuestas = [
      "Disculpa, no entendí tu consulta. ¿Podrías reformularla?",
      "No estoy seguro de lo que necesitas. ¿Quieres consultar productos, tu saldo o tus facturas?",
      "Por favor, sé más específico en tu solicitud para poder ayudarte mejor.",
      "¿Podrías darme más detalles sobre lo que estás buscando?",
      "Para ayudarte mejor, por favor indícame si quieres buscar productos, verificar tu saldo o revisar tus facturas."
    ];
    
    // Elegir una respuesta al azar
    const indice = Math.floor(Math.random() * respuestas.length);
    return respuestas[indice];
  }
} 