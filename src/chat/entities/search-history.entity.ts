/**
 * Entidad que representa el historial de búsquedas de productos.
 * Permite rastrear qué productos busca cada usuario y con qué frecuencia.
 * 
 * @class SearchHistory
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { PersistentSession } from './persistent-session.entity';

@Entity('search_history')
@Index(['phoneNumber', 'searchTerm'])
@Index(['phoneNumber', 'createdAt'])
export class SearchHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Número de teléfono del usuario que realizó la búsqueda
   */
  @Column()
  phoneNumber: string;

  /**
   * Término de búsqueda normalizado
   */
  @Column()
  searchTerm: string;

  /**
   * Término de búsqueda original (como lo escribió el usuario)
   */
  @Column()
  originalSearchTerm: string;

  /**
   * Número de productos encontrados
   */
  @Column({ default: 0 })
  resultsCount: number;

  /**
   * Si la búsqueda tuvo resultados exitosos
   */
  @Column({ default: false })
  hasResults: boolean;

  /**
   * Contexto de la sesión cuando se realizó la búsqueda
   */
  @Column({ nullable: true })
  sessionContext: string;

  /**
   * ID del chatbot que procesó la búsqueda
   */
  @Column({ nullable: true })
  chatbotId: string;

  /**
   * Relación con la sesión persistente
   */
  @ManyToOne(() => PersistentSession)
  @JoinColumn({ name: 'session_id' })
  session: PersistentSession;

  /**
   * ID de la sesión
   */
  @Column('uuid', { nullable: true })
  sessionId: string;

  /**
   * Momento en que se realizó la búsqueda
   */
  @CreateDateColumn()
  createdAt: Date;
} 