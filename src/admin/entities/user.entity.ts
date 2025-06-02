import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  role: 'admin' | 'user' | 'support';

  @Column()
  status: 'active' | 'inactive' | 'blocked';

  @Column('jsonb', { nullable: true })
  metadata: {
    phoneNumber?: string;
    lastLogin?: Date;
    preferences?: {
      language: string;
      notifications: boolean;
      theme: string;
    };
  };

  @OneToMany(() => Conversation, conversation => conversation.user)
  conversations: Conversation[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 