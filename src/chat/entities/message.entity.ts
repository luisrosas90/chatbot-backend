/**
 * Entidad que representa un mensaje en una sesión de chat.
 * Un mensaje puede ser enviado por el usuario o por el asistente.
 * 
 * @class ChatMessage
 */
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ChatSession } from './chat-session.entity';
import { PersistentSession } from './persistent-session.entity';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Contenido del mensaje.
   * Puede ser texto, transcripción de audio o descripción de imagen.
   */
  @Column('text')
  content: string;

  /**
   * Remitente del mensaje.
   * Puede ser 'user' o 'assistant'.
   */
  @Column()
  sender: string;

  /**
   * Momento en que se envió el mensaje.
   */
  @Column()
  timestamp: Date;

  /**
   * Relación muchos a uno con la sesión de chat tradicional.
   */
  @ManyToOne(() => ChatSession, session => session.messages, { nullable: true })
  @JoinColumn({ name: 'chat_session_id' })
  chatSession?: ChatSession;

  /**
   * Relación muchos a uno con la sesión persistente (para el sistema Valery).
   */
  @ManyToOne(() => PersistentSession, session => session.messages, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session?: PersistentSession;

  /**
   * Momento de creación del registro.
   */
  @CreateDateColumn()
  createdAt: Date;
} 