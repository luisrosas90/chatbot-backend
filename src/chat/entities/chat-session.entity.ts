/**
 * Entidad que representa una sesión de chat.
 * Una sesión de chat mantiene el estado y el historial de una conversación
 * entre un usuario y el asistente.
 * 
 * @class ChatSession
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ChatMessage } from './message.entity';

@Entity('chat_sessions')
export class ChatSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Número de teléfono del usuario.
   * Este campo se usa para identificar al usuario en WhatsApp.
   */
  @Column()
  phoneNumber: string;

  /**
   * Estado actual de la sesión.
   * Puede ser 'active' o 'ended'.
   */
  @Column({ default: 'active' })
  status: string;

  /**
   * Momento en que se inició la sesión.
   */
  @CreateDateColumn()
  startTime: Date;

  /**
   * Momento en que se finalizó la sesión.
   * Null si la sesión está activa.
   */
  @Column({ nullable: true })
  endTime: Date;

  /**
   * Momento del último mensaje en la sesión.
   */
  @Column({ nullable: true })
  lastMessageTime: Date;

  /**
   * Contador de mensajes en la sesión.
   * Incluye tanto mensajes del usuario como del asistente.
   */
  @Column({ default: 0 })
  messageCount: number;

  /**
   * Relación uno a muchos con los mensajes de la sesión.
   */
  @OneToMany(() => ChatMessage, message => message.session)
  messages: ChatMessage[];

  /**
   * Momento de creación del registro.
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Momento de última actualización del registro.
   */
  @UpdateDateColumn()
  updatedAt: Date;
} 