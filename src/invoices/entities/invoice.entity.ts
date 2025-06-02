import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('facturas')
export class Invoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'numero_factura' })
  numeroFactura: string;

  @Column({ name: 'codigo_valery' })
  codigoValery: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cliente_id' })
  cliente: User;

  @Column({ name: 'cliente_id' })
  clienteId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  iva: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total: number;

  @Column({ name: 'estado_factura' })
  estadoFactura: string;

  @Column({ name: 'metodo_pago' })
  metodoPago: string;

  @Column({ name: 'fecha_emision', type: 'timestamp' })
  fechaEmision: Date;

  @Column({ name: 'ultima_sincronizacion', type: 'timestamp' })
  ultimaSincronizacion: Date;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'fecha_actualizacion' })
  fechaActualizacion: Date;
} 