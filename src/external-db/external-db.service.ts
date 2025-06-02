import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ExternalDbService {
  private readonly logger = new Logger(ExternalDbService.name);

  constructor(
    @InjectDataSource('externa')
    private externalDataSource: DataSource,
  ) {}

  /**
   * Obtiene productos del inventario
   * @param busqueda Término opcional para buscar por nombre
   * @returns Array de productos
   */
  async obtenerProductos(busqueda?: string) {
    try {
      let query = `
        SELECT 
          i.codigo,
          i.nombre,
          i.existenciaunidad,
          i.preciounidad,
          i.preciomayor,
          i.alicuotaiva,
          i.codunidad,
          i.nombreunidad
        FROM inventario i
        WHERE i.existenciaunidad > 0
      `;

      if (busqueda) {
        query += ` AND i.nombre ILIKE $1 || '%'`;
        const productos = await this.externalDataSource.query(query, [busqueda]);
        return productos;
      }

      const productos = await this.externalDataSource.query(query);
      return productos;
    } catch (error) {
      this.logger.error('Error al obtener productos:', error);
      throw error;
    }
  }

  /**
   * Obtiene cliente por número de teléfono
   * @param telefono Número de teléfono del cliente
   * @returns Datos del cliente
   */
  async obtenerClientePorTelefono(telefono: string) {
    try {
      const cliente = await this.externalDataSource.query(`
        SELECT 
          c.idcliente,
          c.codigocliente,
          c.nombre,
          c.rif,
          c.direccion1,
          c.direccion2,
          c.telefono1,
          c.telefono2,
          c.email,
          c.tienecredito,
          c.diascredito,
          c.saldo,
          c.status
        FROM clientes c
        WHERE c.telefono1 = $1 OR c.telefono2 = $1
      `, [telefono]);
      return cliente[0];
    } catch (error) {
      this.logger.error('Error al obtener cliente por teléfono:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una consulta personalizada en la base de datos externa
   * @param query Consulta SQL a ejecutar
   * @param params Parámetros para la consulta
   * @returns Resultado de la consulta
   */
  async ejecutarQuery(query: string, params: any[] = []) {
    try {
      const resultado = await this.externalDataSource.query(query, params);
      return resultado;
    } catch (error) {
      this.logger.error(`Error al ejecutar query: ${query}`, error);
      throw error;
    }
  }

  /**
   * Ejecuta operaciones en una transacción
   * @param operaciones Función que contiene las operaciones a ejecutar
   * @returns Resultado de la transacción
   */
  async ejecutarTransaccion<T>(operaciones: (manager: any) => Promise<T>): Promise<T> {
    try {
      return await this.externalDataSource.transaction(operaciones);
    } catch (error) {
      this.logger.error('Error al ejecutar transacción:', error);
      throw error;
    }
  }
} 