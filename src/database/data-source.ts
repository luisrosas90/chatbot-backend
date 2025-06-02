import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { ChatSession } from '../chat/entities/chat-session.entity';
import { ChatMessage } from '../chat/entities/message.entity';
import { MessageTemplate } from '../chat/entities/message-template.entity';
import { User } from '../users/entities/user.entity';
import { Chatbot } from '../admin/entities/chatbot.entity';
import { Conversation } from '../admin/entities/conversation.entity';
import { AdminMessage } from '../admin/entities/message.entity';
import { Promotion } from '../promotions/entities/promotion.entity';

// Cargar variables de entorno
config({ path: join(__dirname, '../../.env') });

// Verificar variables de entorno
const dbHost = process.env.DB_HOST || 'dev.telehost.net';
const dbPort = parseInt(process.env.DB_PORT || '5460');
const dbUsername = process.env.DB_USERNAME || 'luis';
const dbPassword = process.env.DB_PASSWORD || 'Lam1414*$';
const dbDatabase = process.env.DB_DATABASE || 'backed';

console.log('Database configuration:', {
  host: dbHost,
  port: dbPort,
  username: dbUsername,
  database: dbDatabase
});

export default new DataSource({
  type: 'postgres',
  host: dbHost,
  port: dbPort,
  username: dbUsername,
  password: dbPassword,
  database: dbDatabase,
  entities: [
    ChatSession,
    ChatMessage,
    MessageTemplate,
    User,
    Chatbot,
    Conversation,
    AdminMessage,
    Promotion
  ],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: true,
}); 