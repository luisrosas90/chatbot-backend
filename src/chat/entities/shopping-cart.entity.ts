/**
 * Entidad que representa el carrito de compras de un usuario.
 * Permite mantener productos seleccionados entre sesiones.
 * 
 * @class ShoppingCart
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity('shopping_carts')
@Index(['phoneNumber', 'status'])
export class ShoppingCart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Número de teléfono del usuario propietario del carrito
   */
  @Column()
  phoneNumber: string;

  /**
   * Código del producto en el inventario
   */
  @Column()
  productCode: string;

  /**
   * Nombre del producto
   */
  @Column()
  productName: string;

  /**
   * Precio unitario en USD del producto
   */
  @Column('decimal', { precision: 10, scale: 2 })
  unitPriceUsd: number;

  /**
   * Alícuota de IVA del producto
   */
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  ivaTax: number;

  /**
   * Cantidad del producto en el carrito
   */
  @Column('int', { default: 1 })
  quantity: number;

  /**
   * Tasa de cambio USD/Bs cuando se agregó al carrito
   */
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  exchangeRate: number;

  /**
   * Estado del carrito: 'active', 'checkout', 'abandoned', 'purchased'
   */
  @Column({ default: 'active' })
  status: string;

  /**
   * ID del chatbot que gestionó la adición
   */
  @Column({ nullable: true })
  chatbotId: string;

  /**
   * Metadatos adicionales del producto (JSON)
   */
  @Column('json', { nullable: true })
  metadata: any;

  /**
   * Relación con la sesión de chat donde se agregó
   */
  @ManyToOne(() => ChatSession)
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  /**
   * ID de la sesión
   */
  @Column('uuid', { nullable: true })
  sessionId: string;

  /**
   * Momento en que se agregó al carrito
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Momento de última actualización
   */
  @UpdateDateColumn()
  updatedAt: Date;
} 