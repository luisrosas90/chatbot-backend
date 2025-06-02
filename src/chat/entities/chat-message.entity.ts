import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ChatSession } from './chat-session.entity';

@Entity('chatbot_chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ChatSession)
  @JoinColumn({ name: 'session_id' })
  session: ChatSession;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'message_type' })
  messageType: 'user' | 'assistant';

  @Column({ name: 'content' })
  content: string;

  @Column({ name: 'sentiment', nullable: true })
  sentiment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
} 