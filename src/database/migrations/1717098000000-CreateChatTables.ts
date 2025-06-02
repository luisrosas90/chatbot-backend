import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateChatTables1717098000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS chatbot_chat_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone_number VARCHAR(20) NOT NULL,
        user_name VARCHAR(100),
        last_message TEXT,
        last_response TEXT,
        message_count INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chatbot_chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID NOT NULL REFERENCES chatbot_chat_sessions(id),
        message_type VARCHAR(10) NOT NULL CHECK (message_type IN ('user', 'assistant')),
        content TEXT NOT NULL,
        sentiment VARCHAR(20),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_chat_sessions_phone ON chatbot_chat_sessions(phone_number);
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_active ON chatbot_chat_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chatbot_chat_messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chatbot_chat_messages(created_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS chatbot_chat_messages;
      DROP TABLE IF EXISTS chatbot_chat_sessions;
    `);
  }
} 