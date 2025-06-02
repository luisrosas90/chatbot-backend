import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('productos')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'codigo_valery' })
  codigoValery: string;

  @Column()
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  precio: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'precio_iva' })
  precioIva: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'precio_neto' })
  precioNeto: number;

  @Column({ name: 'codigo_iva' })
  codigoIva: string;

  @Column({ name: 'ultima_sincronizacion', type: 'timestamp' })
  ultimaSincronizacion: Date;

  @Column({ default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
} 