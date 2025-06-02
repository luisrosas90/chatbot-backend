import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('admin_messages')
export class AdminMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @Column()
  direction: 'incoming' | 'outgoing';

  @Column()
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';

  @Column('jsonb', { nullable: true })
  metadata: {
    mimeType?: string;
    fileName?: string;
    fileSize?: number;
    latitude?: number;
    longitude?: number;
    locationName?: string;
  };

  @ManyToOne(() => Conversation, conversation => conversation.messages)
  conversation: Conversation;

  @CreateDateColumn()
  createdAt: Date;
} 