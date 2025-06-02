/**
 * Configuración global de la aplicación.
 * Este archivo define las variables de entorno y configuraciones
 * necesarias para el funcionamiento del sistema.
 * 
 * @module Configuration
 */
export default () => ({
  port: parseInt(process.env.PORT, 10) || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  
  database: {
    users: {
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_DATABASE || 'chatbot',
      retryAttempts: 3,
      retryDelay: 3000,
      ssl: false,
    },
    admin: {
      type: 'postgres',
      host: process.env.ADMIN_DB_HOST || 'localhost',
      port: parseInt(process.env.ADMIN_DB_PORT, 10) || 5432,
      username: process.env.ADMIN_DB_USERNAME || 'postgres',
      password: process.env.ADMIN_DB_PASSWORD || 'password',
      database: process.env.ADMIN_DB_DATABASE || 'admin',
      retryAttempts: 3,
      retryDelay: 3000,
      ssl: false,
    },
    externa: {
      type: 'postgres',
      host: process.env.EXTERNAL_DB_HOST || 'localhost',
      port: parseInt(process.env.EXTERNAL_DB_PORT, 10) || 3306,
      username: process.env.EXTERNAL_DB_USERNAME || 'user',
      password: process.env.EXTERNAL_DB_PASSWORD || 'password',
      database: process.env.EXTERNAL_DB_NAME || 'valery_database',
      retryAttempts: 3,
      retryDelay: 3000,
      ssl: false,
    },
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-this-in-production',
    expiresIn: process.env.JWT_EXPIRATION || '24h',
  },

  evolution: {
    apiUrl: process.env.EVOLUTION_API_URL || 'https://api.evolution.com',
    apiKey: process.env.EVOLUTION_API_KEY || 'your-evolution-api-key',
  },

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'your-deepseek-api-key',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1',
  },

  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://api.evolution.com',
    instance: process.env.WHATSAPP_INSTANCE || 'your-instance-id',
  },

  ai: {
    apiKey: process.env.AI_API_KEY || 'your-openai-api-key',
    whisperUrl: 'https://api.openai.com/v1/audio/transcriptions',
    chatUrl: 'https://api.openai.com/v1/chat/completions',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    systemPrompt: process.env.AI_SYSTEM_PROMPT || `Eres un asistente virtual especializado en atención al cliente para una empresa de tecnología. 
Tu objetivo es ayudar a los clientes de manera profesional y amable.

Instrucciones específicas:
1. Responde siempre en español de manera clara y concisa.
2. Mantén un tono profesional pero amigable.
3. Si no sabes algo, sé honesto y ofrece buscar la información.
4. Enfócate en resolver problemas y brindar soluciones.
5. Usa emojis ocasionalmente para hacer la conversación más amena.
6. Si el cliente tiene una queja, muestra empatía y ofrece ayuda inmediata.
7. Si el cliente necesita información técnica, proporciona detalles precisos.
8. Si el cliente quiere hablar con un humano, ofrece la opción de transferir la conversación.

Recuerda: Tu objetivo es brindar la mejor experiencia posible al cliente.`,
  },

  valery: {
    apiUrl: process.env.VALERY_API_URL,
    apiKey: process.env.VALERY_API_KEY,
    syncInterval: parseInt(process.env.VALERY_SYNC_INTERVAL, 10) || 3600000, // 1 hora por defecto
  },
}); 