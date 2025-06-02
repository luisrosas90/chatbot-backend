import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalDbService } from '../external-db/external-db.service';

@Injectable()
export class ValeryDbService {
  private readonly logger = new Logger(ValeryDbService.name);

  constructor(
    private configService: ConfigService,
    private externalDbService: ExternalDbService
  ) {}

  async obtenerProductos(busqueda?: string) {
    try {
      return this.externalDbService.obtenerProductos(busqueda);
    } catch (error) {
      this.logger.error('Error al obtener productos:', error);
      throw error;
    }
  }

  /**
   * Buscar productos por lista de términos
   * Permite buscar múltiples productos separados por comas o líneas
   */
  async buscarProductosPorLista(listaProductos: string) {
    try {
      // Normalizar la lista: dividir por comas, saltos de línea, o punto y coma
      const terminos = listaProductos
        .split(/[,\n;]+/)
        .map(termino => termino.trim())
        .filter(termino => termino.length > 2); // Solo términos con más de 2 caracteres

      if (terminos.length === 0) {
        return [];
      }

      // Construir consulta para buscar todos los términos
      const condiciones = terminos.map((_, index) => 
        `LOWER(TRANSLATE(i.nombre, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU')) LIKE LOWER(TRANSLATE($${index + 1}, 'ñáéíóúüÑÁÉÍÓÚÜ', 'naeiouuNAEIOUU'))`
      ).join(' OR ');

      const query = `
        SELECT 
          i.codigo,
          i.nombre,
          i.preciounidad,
          i.alicuotaiva,
          i.existenciaunidad,
          i.status,
          (SELECT factorcambio FROM monedas WHERE codmoneda = '02' LIMIT 1) AS tasa_actual
        FROM inventario i
        WHERE (i.status = 'A' OR i.status = '1')
          AND i.existenciaunidad >= 1
          AND (${condiciones})
        ORDER BY 
          i.existenciaunidad DESC,
          LENGTH(i.nombre),
          i.nombre
        LIMIT 50
      `;

      const parametros = terminos.map(termino => `%${termino}%`);
      
      const productos = await this.externalDbService.ejecutarQuery(query, parametros);
      
      this.logger.log(`🔍 Búsqueda por lista: ${terminos.length} términos, ${productos.length} productos encontrados`);
      
      // Agrupar productos por término de búsqueda para mejor organización
      const resultadosAgrupados = {
        productos: productos,
        terminos: terminos,
        estadisticas: {
          terminosBuscados: terminos.length,
          productosEncontrados: productos.length,
          promedioPorTermino: Math.round(productos.length / terminos.length * 100) / 100
        }
      };

      return resultadosAgrupados;
      
    } catch (error) {
      this.logger.error('Error al buscar productos por lista:', error);
      throw error;
    }
  }

  async obtenerFacturasCliente(codigoCliente: string) {
    try {
      const query = `
        SELECT 
          f.numero_factura,
          f.fecha_emision,
          f.subtotal,
          f.iva,
          f.total,
          f.estado,
          f.metodo_pago
        FROM facturas f
        WHERE f.codigo_cliente = $1
        ORDER BY f.fecha_emision DESC
        LIMIT 10
      `;
      
      return this.externalDbService.ejecutarQuery(query, [codigoCliente]);
    } catch (error) {
      this.logger.error('Error al obtener facturas del cliente:', error);
      throw error;
    }
  }

  async obtenerClientePorTelefono(telefono: string) {
    try {
      return this.externalDbService.obtenerClientePorTelefono(telefono);
    } catch (error) {
      this.logger.error('Error al obtener cliente por teléfono:', error);
      throw error;
    }
  }

  async obtenerProductosPorCategoria(categoria: string) {
    try {
      const query = `
        SELECT 
          i.codigo,
          i.nombre,
          i.preciounidad,
          i.existenciaunidad,
          d.departamento as categoria
        FROM inventario i
        LEFT JOIN departamentos d ON i.coddepto = d.coddepto
        WHERE LOWER(d.departamento) = LOWER($1) 
          AND i.status = '1'
          AND i.existenciaunidad > 0
        ORDER BY i.nombre
      `;
      
      return this.externalDbService.ejecutarQuery(query, [categoria]);
    } catch (error) {
      this.logger.error('Error al obtener productos por categoría:', error);
      throw error;
    }
  }

  async obtenerStockProducto(codigoProducto: string) {
    try {
      const query = `
        SELECT 
          i.existenciaunidad as cantidad_disponible,
          i.existenciamayor,
          i.preciounidad,
          i.preciomayor,
          i.status
        FROM inventario i
        WHERE i.codigo = $1
      `;
      
      const resultado = await this.externalDbService.ejecutarQuery(query, [codigoProducto]);
      return resultado[0];
    } catch (error) {
      this.logger.error('Error al obtener stock del producto:', error);
      throw error;
    }
  }

  async crearPedido(datosPedido: any) {
    try {
      // 1. Crear encabezado del pedido
      const encabezadoQuery = `
        INSERT INTO encabedoc (
          codcliente, nombrecliente, rif, telefonos, monedacodigo, 
          moneda, depositocodigo, usuariocodigo, tasa, subtotal, 
          iva, total, esexento, fechaemision, hora, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_DATE, CURRENT_TIME, 'PE')
        RETURNING idencabedoc
      `;
      
      const encabezado = await this.externalDbService.ejecutarQuery(encabezadoQuery, [
        datosPedido.codcliente,
        datosPedido.nombrecliente,
        datosPedido.rif,
        datosPedido.telefonos,
        datosPedido.monedacodigo,
        datosPedido.moneda,
        datosPedido.depositocodigo,
        datosPedido.usuariocodigo,
        datosPedido.tasa,
        datosPedido.subtotal,
        datosPedido.iva,
        datosPedido.total,
        datosPedido.esexento
      ]);

      const idencabedoc = encabezado[0].idencabedoc;

      // 2. Crear movimientos del pedido
      for (const item of datosPedido.items) {
        const movimientoQuery = `
          INSERT INTO movimientosdoc (
            idencabedoc, codigo, nombre, descripcionreal, cantidad,
            precio, iva, preciototal, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PE')
        `;
        
        await this.externalDbService.ejecutarQuery(movimientoQuery, [
          idencabedoc,
          item.codigo,
          item.nombre,
          item.descripcion,
          item.cantidad,
          item.precio,
          item.iva,
          item.preciototal
        ]);
      }

      // 3. Crear registro de pago
      const pagoQuery = `
        INSERT INTO pagos (
          idencabedoc, idtipo, monto, codigobanco, banco,
          clienteid, telefono, fechatrans
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
      `;
      
      await this.externalDbService.ejecutarQuery(pagoQuery, [
        idencabedoc,
        datosPedido.tipoPago,
        datosPedido.monto,
        datosPedido.codigobanco,
        datosPedido.banco,
        datosPedido.clienteid,
        datosPedido.telefono
      ]);

      return idencabedoc;
    } catch (error) {
      this.logger.error('Error al crear pedido:', error);
      throw error;
    }
  }

  async obtenerMetodosPago() {
    try {
      const query = `
        SELECT idtipo, pago
        FROM tipospagos
      `;
      
      return this.externalDbService.ejecutarQuery(query);
    } catch (error) {
      this.logger.error('Error al obtener métodos de pago:', error);
      throw error;
    }
  }

  async obtenerBancos() {
    try {
      const query = `
        SELECT codigo, banco
        FROM bancos
        WHERE status = 'SI'
        ORDER BY banco
      `;
      
      return this.externalDbService.ejecutarQuery(query);
    } catch (error) {
      this.logger.error('Error al obtener bancos:', error);
      throw error;
    }
  }

  async actualizarEstadoPedido(idencabedoc: number, nuevoEstado: string) {
    try {
      const encabezadoQuery = `
        UPDATE encabedoc
        SET status = $1
        WHERE idencabedoc = $2
      `;
      
      await this.externalDbService.ejecutarQuery(encabezadoQuery, [nuevoEstado, idencabedoc]);

      const movimientoQuery = `
        UPDATE movimientosdoc
        SET status = $1
        WHERE idencabedoc = $2
      `;
      
      await this.externalDbService.ejecutarQuery(movimientoQuery, [nuevoEstado, idencabedoc]);
    } catch (error) {
      this.logger.error('Error al actualizar estado del pedido:', error);
      throw error;
    }
  }

  async asignarDelivery(idencabedoc: number, idcolaborador: number, direccion: string, telefono: string) {
    try {
      const query = `
        INSERT INTO delivery (
          idencabedoc, idcolaborador, direccion, telefono,
          fechaasignacion, status
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'PE')
      `;
      
      await this.externalDbService.ejecutarQuery(query, [
        idencabedoc,
        idcolaborador,
        direccion,
        telefono
      ]);
    } catch (error) {
      this.logger.error('Error al asignar delivery:', error);
      throw error;
    }
  }

  // Método para ejecutar queries personalizadas
  async ejecutarQuery(query: string, params?: any[]) {
    try {
      return this.externalDbService.ejecutarQuery(query, params);
    } catch (error) {
      this.logger.error('Error al ejecutar query:', error);
      throw error;
    }
  }

  // ===== SISTEMA COMPLETO DE PEDIDOS (N8N) =====

  /**
   * Obtener todas las monedas y sus factores de cambio
   */
  async obtenerMonedas() {
    try {
      const query = `SELECT codmoneda, moneda, factorcambio FROM monedas`;
      return this.externalDbService.ejecutarQuery(query);
    } catch (error) {
      this.logger.error('Error al obtener monedas:', error);
      throw error;
    }
  }

  /**
   * Determinar tipo de moneda basado en método de pago
   * 1 = PAGO MOVIL (Bolívares), 4 = EFECTIVO BOLIVARES (Bolívares)
   * 2,3,5,6 = USD (Dólares)
   */
  private determinarCodigoMoneda(idPago: number): string {
    if (idPago === 1 || idPago === 4) {
      return "01"; // Bolívares
    }
    return "02"; // USD por defecto
  }

  /**
   * Crear pedido completo siguiendo la lógica de N8N
   */
  async crearPedidoCompleto(datosInput: any) {
    try {
      return await this.externalDbService.ejecutarTransaccion(async manager => {
        // 1. Obtener monedas para lógica de conversión
        const monedas = await manager.query(`SELECT codmoneda, moneda, factorcambio FROM monedas`);
        
        // 2. Validar estructura de datos
        if (!datosInput.pedido || !Array.isArray(datosInput.productos)) {
          throw new Error("Estructura de datos inválida. Se requiere 'pedido' y 'productos'");
        }

        const pedido = datosInput.pedido;
        const productos = datosInput.productos;

        // 3. Validar campos obligatorios del pedido
        const camposObligatorios = [
          'codigocliente', 'nombrecliente', 'telefonos',
          'subtotal', 'iva', 'total', 'observaciones'
        ];
        
        for (const campo of camposObligatorios) {
          if (typeof pedido[campo] === 'undefined') {
            throw new Error(`Falta el campo obligatorio: ${campo}`);
          }
        }

        // 4. Determinar moneda de transacción
        const idPago = parseInt(pedido.idpago) || 2; // Default a USD
        const codmonedaTransaccion = this.determinarCodigoMoneda(idPago);
        
        // 5. Obtener información de monedas
        const infoMonedaTransaccion = monedas.find(m => 
          String(m.codmoneda).trim().padStart(2, '0') === codmonedaTransaccion
        );
        
        if (!infoMonedaTransaccion) {
          throw new Error(`No se encontró definición para moneda ${codmonedaTransaccion}`);
        }

        // 6. Obtener tasa del dólar para referencia
        const infoMonedaDolar = monedas.find(m => 
          String(m.codmoneda).trim().padStart(2, '0') === "02"
        );
        
        if (!infoMonedaDolar) {
          throw new Error("No se encontró definición para moneda USD (02)");
        }

        // 7. Preparar datos del pedido con conversión correcta de monedas
        let subtotalFinal = parseFloat(pedido.subtotal);
        let ivaFinal = parseFloat(pedido.iva);
        let totalFinal = parseFloat(pedido.total);
        let tasaUsada = parseFloat(infoMonedaDolar.factorcambio);

        // Si la moneda de transacción es Bolívares, convertir de USD a Bolívares
        if (codmonedaTransaccion === "01") {
          const factorCambio = parseFloat(infoMonedaTransaccion.factorcambio);
          subtotalFinal = subtotalFinal * factorCambio;
          ivaFinal = ivaFinal * factorCambio;
          totalFinal = totalFinal * factorCambio;
          tasaUsada = factorCambio;
        }

        // Asegurar formato correcto de fecha y hora
        const ahora = new Date();
        const fechaEmision = pedido.fechaemision || ahora.toISOString().slice(0, 10);
        const horaEmision = pedido.hora || ahora.toTimeString().slice(0, 8);

        const datosEncabezado = {
          codcliente: pedido.codigocliente || pedido.rif || '10123456',
          nombrecliente: pedido.nombrecliente || pedido.nombre || 'SIN NOMBRE',
          rif: pedido.rif || pedido.codigocliente || 'V0000000',
          telefonos: pedido.telefonos || pedido.telefono || '0414000000',
          vendedorcodigo: 'V001',
          nombrevendedor: 'CHATBOT AI',
          monedacodigo: codmonedaTransaccion,
          moneda: infoMonedaTransaccion.moneda,
          depositocodigo: '01',
          usuariocodigo: pedido.idusuario || 'remoto',
          tasa: tasaUsada,
          subtotal: subtotalFinal,
          iva: ivaFinal,
          total: totalFinal,
          esexento: false,
          fechaemision: fechaEmision,
          hora: horaEmision,
          status: pedido.status || 'G',
          observaciones: pedido.observaciones || 'Pedido vía WhatsApp'
        };

        // 8. Insertar encabezado del pedido
        const encabezadoQuery = `
          INSERT INTO encabedoc (
            codcliente, nombrecliente, rif, telefonos,
            vendedorcodigo, nombrevendedor, monedacodigo, moneda, depositocodigo,
            usuariocodigo, tasa, subtotal, iva, total,
            esexento, fechaemision, hora, status, observaciones
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
          )
          RETURNING idencabedoc
        `;

        const encabezadoResult = await manager.query(encabezadoQuery, [
          datosEncabezado.codcliente,
          datosEncabezado.nombrecliente,
          datosEncabezado.rif,
          datosEncabezado.telefonos,
          datosEncabezado.vendedorcodigo,
          datosEncabezado.nombrevendedor,
          datosEncabezado.monedacodigo,
          datosEncabezado.moneda,
          datosEncabezado.depositocodigo,
          datosEncabezado.usuariocodigo,
          datosEncabezado.tasa,
          datosEncabezado.subtotal,
          datosEncabezado.iva,
          datosEncabezado.total,
          datosEncabezado.esexento,
          datosEncabezado.fechaemision,
          datosEncabezado.hora,
          datosEncabezado.status,
          datosEncabezado.observaciones
        ]);

        const idencabedoc = encabezadoResult[0].idencabedoc;
        this.logger.log(`✅ Encabezado creado con ID: ${idencabedoc}`);

        // 9. Insertar registro de pago con monto correcto
        const tipoPago = pedido.idpago || 1;
        const pagoQuery = `
          INSERT INTO pagos (idencabedoc, idtipo, monto)
          VALUES ($1, $2, $3)
          RETURNING idtipo
        `;

        await manager.query(pagoQuery, [idencabedoc, tipoPago, totalFinal]);
        this.logger.log(`✅ Pago registrado para pedido ${idencabedoc} por monto ${totalFinal}`);

        // 10. Insertar productos (movimientos)
        for (const producto of productos) {
          const datosProducto = {
            idencabedoc: idencabedoc,
            codigo: producto.codigo,
            nombre: producto.nombre,
            descripcionreal: producto.descripcionreal || producto.nombre,
            esimportacion: Boolean(producto.esimportacion),
            esexento: Boolean(producto.esexento),
            peso: producto.peso ? Number(producto.peso) : null,
            cantidad: Number(producto.cantidad),
            precio: Number(producto.precio),
            iva: Number(producto.iva || 0),
            preciototal: Number(producto.cantidad) * Number(producto.precio),
            status: producto.status || 'G',
            desstatus: producto.desstatus || 'PRODUCTO EN STOCK',
            tiempoentrega: producto.tiempoentrega || 'INMEDIATO'
          };

          const movimientoQuery = `
            INSERT INTO movimientosdoc (
              idencabedoc, codigo, nombre, descripcionreal, 
              esimportacion, esexento, peso, cantidad, precio, iva, preciototal,
              status, desstatus, tiempoentrega
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            RETURNING idmovimientosdoc
          `;

          await manager.query(movimientoQuery, [
            datosProducto.idencabedoc,
            datosProducto.codigo,
            datosProducto.nombre,
            datosProducto.descripcionreal,
            datosProducto.esimportacion,
            datosProducto.esexento,
            datosProducto.peso,
            datosProducto.cantidad,
            datosProducto.precio,
            datosProducto.iva,
            datosProducto.preciototal,
            datosProducto.status,
            datosProducto.desstatus,
            datosProducto.tiempoentrega
          ]);
        }

        this.logger.log(`✅ ${productos.length} productos insertados para pedido ${idencabedoc}`);

        return {
          success: true,
          idencabedoc: idencabedoc,
          confirmacion: `Pedido creado con ID ${idencabedoc}`,
          detalles: {
            total: datosEncabezado.total,
            moneda: datosEncabezado.moneda,
            productos: productos.length
          }
        };
      });
      
    } catch (error) {
      this.logger.error('Error al crear pedido completo:', error);
      throw error;
    }
  }

  /**
   * Convertir carrito de compras a formato de pedido
   */
  async convertirCarritoAPedido(phoneNumber: string, metodoPago: number = 2): Promise<any> {
    try {
      // Obtener información del cliente
      const cliente = await this.obtenerClientePorTelefono(phoneNumber);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }

      // Obtener items del carrito
      const queryCarrito = `
        SELECT 
          sc.productCode,
          sc.productName,
          sc.quantity,
          sc.unitPriceUsd,
          sc.ivaTax,
          sc.exchangeRate
        FROM shopping_carts sc
        INNER JOIN persistent_sessions ps ON sc.session_id = ps.id
        WHERE ps.phoneNumber = $1 AND sc.isActive = true
      `;
      
      const cartItems = await this.ejecutarQuery(queryCarrito, [phoneNumber]);
      
      if (!cartItems || cartItems.length === 0) {
        throw new Error('Carrito vacío');
      }

      // Calcular totales
      let subtotalUsd = 0;
      let totalIva = 0;
      
      const productos = cartItems.map(item => {
        const cantidad = Number(item.quantity);
        const precioUnitario = Number(item.unitPriceUsd);
        const iva = Number(item.ivaTax);
        const subtotalProducto = cantidad * precioUnitario;
        const ivaProducto = subtotalProducto * (iva / 100);
        
        subtotalUsd += subtotalProducto;
        totalIva += ivaProducto;
        
        return {
          codigo: item.productCode,
          nombre: item.productName,
          descripcionreal: item.productName,
          cantidad: cantidad,
          precio: precioUnitario,
          iva: iva,
          preciototal: subtotalProducto,
          esimportacion: false,
          esexento: iva === 0,
          peso: null,
          status: 'G',
          desstatus: 'PRODUCTO EN STOCK',
          tiempoentrega: 'INMEDIATO'
        };
      });

      const totalUsd = subtotalUsd + totalIva;

      // Crear objeto pedido
      const pedido = {
        codigocliente: cliente.codigocliente,
        nombrecliente: cliente.nombre,
        rif: cliente.rif,
        telefonos: phoneNumber,
        idpago: metodoPago,
        subtotal: subtotalUsd,
        iva: totalIva,
        total: totalUsd,
        observaciones: `Pedido desde WhatsApp - ${new Date().toLocaleString()}`,
        fechaemision: new Date().toISOString().slice(0, 10),
        hora: new Date().toTimeString().split(' ')[0]
      };

      return {
        pedido,
        productos
      };

    } catch (error) {
      this.logger.error('Error al convertir carrito a pedido:', error);
      throw error;
    }
  }

  /**
   * Registrar información de pago en tabla pagos
   * Se usa cuando el cliente proporciona datos de pago móvil o transferencia
   */
  async registrarInformacionPago(datosPago: {
    idencabedoc: number;
    idtipo: number;
    monto: number;
    codigobanco?: number;
    banco?: string;
    clienteid?: string;
    telefono?: string;
    nroreferencia?: string;
  }) {
    try {
      const query = `
        INSERT INTO pagos (
          idencabedoc, idtipo, monto, codigobanco, banco,
          clienteid, telefono, fechatrans, nrocontrol
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, $8
        ) RETURNING *
      `;

      const valores = [
        datosPago.idencabedoc,
        datosPago.idtipo,
        datosPago.monto,
        datosPago.codigobanco || null,
        datosPago.banco || null,
        datosPago.clienteid || null,
        datosPago.telefono || null,
        datosPago.nroreferencia || null
      ];

      const resultado = await this.externalDbService.ejecutarQuery(query, valores);
      
      this.logger.log(`✅ Información de pago registrada para pedido ${datosPago.idencabedoc}`);
      
      return resultado[0];
      
    } catch (error) {
      this.logger.error('Error al registrar información de pago:', error);
      throw error;
    }
  }

  /**
   * Validar que el cliente existe en la base de datos
   */
  async validarCliente(cedula: string) {
    try {
      const cedulaNormalizada = cedula.replace(/[^0-9]/g, '');
      
      const query = `
        SELECT 
          codigocliente,
          nombre,
          rif,
          telefono1,
          telefono2,
          status
        FROM clientes
        WHERE rif = $1 OR rif = $2 OR rif = $3
        LIMIT 1
      `;

      const variaciones = [
        cedulaNormalizada,
        `V${cedulaNormalizada}`,
        `J${cedulaNormalizada}`
      ];

      const resultado = await this.externalDbService.ejecutarQuery(query, variaciones);
      
      return resultado.length > 0 ? resultado[0] : null;
      
    } catch (error) {
      this.logger.error('Error al validar cliente:', error);
      throw error;
    }
  }
} 