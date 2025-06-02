-- Crear tabla de sesiones de chat
CREATE TABLE IF NOT EXISTS chatbot_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    whatsapp_number VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de mensajes
CREATE TABLE IF NOT EXISTS chatbot_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES chatbot_sessions(id),
    content TEXT NOT NULL,
    type VARCHAR(10) NOT NULL, -- 'user' o 'bot'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de configuración del chatbot
CREATE TABLE IF NOT EXISTS chatbot_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insertar configuración inicial
INSERT INTO chatbot_config (key, value) VALUES
    ('welcome_message', '¡Hola! ¿En qué puedo ayudarte hoy?'),
    ('fallback_message', 'Lo siento, no entiendo tu pregunta. ¿Podrías reformularla?'),
    ('max_retries', '3')
ON CONFLICT (key) DO NOTHING; 