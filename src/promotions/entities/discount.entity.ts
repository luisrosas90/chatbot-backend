import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount',
  FREE_SHIPPING = 'free_shipping',
  BUY_X_GET_Y = 'buy_x_get_y'
}

export enum DiscountStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  SCHEDULED = 'scheduled'
}

@Entity('discounts')
@Index(['status', 'startDate', 'endDate'])
export class Discount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Nombre del descuento
   */
  @Column()
  name: string;

  /**
   * Descripción del descuento
   */
  @Column('text', { nullable: true })
  description: string;

  /**
   * Tipo de descuento
   */
  @Column({
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.PERCENTAGE
  })
  type: DiscountType;

  /**
   * Valor del descuento (porcentaje o monto fijo)
   */
  @Column('decimal', { precision: 10, scale: 2 })
  value: number;

  /**
   * Monto mínimo de compra para aplicar
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  minimumAmount: number;

  /**
   * Monto máximo de descuento
   */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  maximumDiscount: number;

  /**
   * Productos específicos (códigos separados por coma)
   */
  @Column('text', { nullable: true })
  applicableProducts: string;

  /**
   * Categorías específicas (códigos separados por coma)
   */
  @Column('text', { nullable: true })
  applicableCategories: string;

  /**
   * Códigos de promoción válidos
   */
  @Column('text', { nullable: true })
  promoCodes: string;

  /**
   * Límite de usos por cliente
   */
  @Column('int', { nullable: true })
  usageLimit: number;

  /**
   * Límite total de usos
   */
  @Column('int', { nullable: true })
  totalUsageLimit: number;

  /**
   * Contador de usos actuales
   */
  @Column('int', { default: 0 })
  currentUsage: number;

  /**
   * Fecha de inicio
   */
  @Column()
  startDate: Date;

  /**
   * Fecha de fin
   */
  @Column()
  endDate: Date;

  /**
   * Estado del descuento
   */
  @Column({
    type: 'enum',
    enum: DiscountStatus,
    default: DiscountStatus.ACTIVE
  })
  status: DiscountStatus;

  /**
   * Si es una oferta del día
   */
  @Column({ default: false })
  isDailyOffer: boolean;

  /**
   * Prioridad del descuento (mayor número = mayor prioridad)
   */
  @Column('int', { default: 1 })
  priority: number;

  /**
   * Metadatos adicionales (JSON)
   */
  @Column('json', { nullable: true })
  metadata: any;

  /**
   * Usuario que creó el descuento
   */
  @Column({ nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 