import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('chatbots')
export class Chatbot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  apiKey: string;

  @Column()
  isActive: boolean;

  @Column('jsonb')
  settings: {
    welcomeMessage: string;
    fallbackMessage: string;
    maxRetries: number;
    timeout: number;
    language: string;
    type?: 'valery' | 'openai' | 'anthropic' | 'standard';
    whatsapp: {
      instanceId: string;
      provider: 'evolution-api' | 'waba-sms';
      apiUrl: string;
      apiKey: string;
      webhookUrl?: string;
      webhookEvents?: string[];
      webhookSecret?: string;
    };
  };

  @OneToMany(() => Conversation, conversation => conversation.chatbot)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 