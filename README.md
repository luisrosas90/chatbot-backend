# Backend del Chatbot GómezMarket

Este es el backend de un sistema de chatbot avanzado que integra WhatsApp con servicios de IA para proporcionar respuestas inteligentes a los usuarios, específicamente diseñado para el sistema Valery de GómezMarket.

## 🚀 Características Principales

### 🤖 **Chatbot Inteligente**
- Búsqueda de productos por listas (múltiples productos separados por comas/líneas)
- Validación instantánea de pagos móviles con selección de banco
- Corrección automática de errores de fecha y moneda
- Conversión automática USD ↔ Bolívares usando factor de cambio
- Manejo avanzado de sesiones persistentes

### 📱 **Integración WhatsApp**
- Integración completa con Evolution API
- Procesamiento de mensajes de texto, audio e imágenes
- Webhook inteligente para recepción de mensajes
- Soporte para múltiples proveedores (Evolution API, WABA-SMS)

### 🛒 **Sistema de Carritos**
- Detección automática de carritos abandonados (>24h)
- Mensajes de recuperación personalizados
- Estadísticas de recuperación en tiempo real
- Limpieza automática de carritos antiguos (>30 días)

### 💰 **Gestión de Pagos**
- Validación de clientes por cédula
- Integración con múltiples bancos para pagos móviles
- Registro completo de transacciones
- Flujo completo de validación en 8 pasos

### 🎯 **Sistema de Descuentos**
- Ofertas del día automáticas
- Múltiples tipos: porcentaje, monto fijo, envío gratis, compra X obtén Y
- Validaciones por monto mínimo y productos aplicables
- Seguimiento de uso y efectividad

### 📊 **Panel de Administración**
- Dashboard en tiempo real con métricas avanzadas
- Configuración visual del chatbot (sin código)
- Gestión de plantillas de mensajes
- Reportes completos de ventas y rendimiento
- Monitor de sesiones activas

### 🔔 **Sistema de Notificaciones**
- Notificaciones automáticas programables
- Envío masivo segmentado
- Historial completo con estadísticas
- Integración con WhatsApp para envíos

## 🛠️ Tecnologías

- **Backend**: NestJS con TypeScript
- **Frontend**: Alpine.js + Tailwind CSS
- **Base de Datos**: MySQL (externa - Sistema Valery)
- **Mensajería**: Evolution API para WhatsApp
- **IA**: OpenAI/Anthropic para procesamiento inteligente
- **Visualización**: Chart.js para gráficos
- **Documentación**: Swagger UI

## 🗃️ Estructura del Proyecto

```
src/
├── admin/              # Panel de administración
│   ├── controllers/    # Controladores admin
│   ├── services/       # Servicios administrativos
│   ├── entities/       # Entidades admin
│   └── dto/           # DTOs para validación
├── ai/                 # Servicios de IA
├── auth/              # Autenticación y autorización
├── chat/              # Gestión de chat y sesiones
├── carts/             # Gestión de carritos
├── notifications/     # Sistema de notificaciones
├── payments/          # Procesamiento de pagos
├── promotions/        # Gestión de descuentos
├── reports/           # Generación de reportes
├── users/             # Gestión de usuarios
├── valery/            # Integración sistema Valery
├── whatsapp/          # Integración WhatsApp
└── config/            # Configuración
```

## ⚙️ Instalación

1. **Clonar el repositorio**:
```bash
git clone https://github.com/luisrosas90/chatbot-backend.git
cd chatbot-backend
```

2. **Instalar dependencias**:
```bash
npm install
```

3. **Configurar variables de entorno**:
```bash
cp .env.example .env
# Editar .env con tus credenciales
```

4. **Ejecutar migraciones**:
```bash
npm run migration:run
```

5. **Iniciar el servidor**:
```bash
npm run start:dev
```

## 🌐 API Endpoints Principales

### WhatsApp
- `POST /api/whatsapp/webhook` - Webhook para recibir mensajes
- `GET /api/whatsapp/status` - Estado de la conexión
- `POST /api/whatsapp/send` - Enviar mensaje

### Chat y Sesiones
- `POST /api/chat/message` - Procesar mensaje de usuario
- `GET /api/chat/history/:phoneNumber` - Historial de conversación
- `POST /api/chat/session/:phoneNumber/end` - Finalizar sesión

### Panel de Administración
- `GET /api/admin/dashboard` - Métricas del dashboard
- `GET/PUT /api/admin/config/chatbot` - Configuración del bot
- `GET/POST/PUT/DELETE /api/admin/templates` - Plantillas de mensajes
- `GET /api/admin/carts/abandoned` - Carritos abandonados
- `POST /api/admin/carts/send-recovery/:id` - Enviar recuperación
- `GET/POST/PUT/DELETE /api/admin/discounts` - Gestión de descuentos
- `POST /api/admin/notifications/send` - Envío masivo
- `GET /api/admin/reports` - Reportes varios
- `GET /api/admin/sessions` - Sesiones activas

### Carritos y Comercio
- `GET /api/carts/abandoned` - Obtener carritos abandonados
- `POST /api/carts/recover/:id` - Recuperar carrito específico

### Reportes
- `GET /api/reports/sales` - Reporte de ventas
- `GET /api/reports/customers` - Reporte de clientes
- `GET /api/reports/products` - Productos populares
- `GET /api/reports/chatbot` - Rendimiento del chatbot

## 🎨 Panel de Administración

El proyecto incluye un panel de administración completo:

### Archivos Frontend
- `admin-dashboard.html` - Panel principal
- `admin-dashboard-extended.html` - Vistas adicionales
- `README-FRONTEND-ADMIN.md` - Documentación del panel

### Funcionalidades del Panel
- **Dashboard**: Métricas en tiempo real
- **Configuración**: Personalidad, formato, tiempos de respuesta
- **Plantillas**: Gestión de mensajes predefinidos
- **Carritos**: Recuperación de ventas perdidas
- **Descuentos**: Creación y gestión de ofertas
- **Notificaciones**: Envío masivo y programado
- **Reportes**: Análisis completo de rendimiento
- **Sesiones**: Monitor en tiempo real de usuarios

## 📈 Funcionalidades Avanzadas

### Búsqueda por Listas
```
Usuario: "arroz, aceite, pollo, 2kg azucar"
Bot: Encuentra y muestra hasta 50 productos ordenados por relevancia
```

### Validación de Pagos Móviles
```
1. Selección de banco
2. Ingreso de teléfono
3. Validación de cliente por cédula
4. Ingreso de referencia
5. Verificación automática
6. Registro en base de datos
7. Confirmación al usuario
8. Actualización de pedido
```

### Conversión de Monedas
```
Sistema detecta USD → Convierte a Bolívares usando factorcambio
Configuración: codmoneda="02" (USD), codmoneda="01" (Bolívares)
```

## 🔧 Configuración de Entorno

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=usuario
DB_PASSWORD=password
DB_DATABASE=valery

# WhatsApp
EVOLUTION_API_URL=https://api.evolution.com
EVOLUTION_API_KEY=tu_api_key

# IA
OPENAI_API_KEY=tu_openai_key
ANTHROPIC_API_KEY=tu_anthropic_key

# Configuración general
PORT=3000
NODE_ENV=development
```

## 📋 Scripts Disponibles

- `npm run start` - Iniciar en producción
- `npm run start:dev` - Desarrollo con hot reload
- `npm run build` - Compilar TypeScript
- `npm run test` - Ejecutar pruebas
- `npm run migration:generate` - Generar migración
- `npm run migration:run` - Ejecutar migraciones
- `npm run migration:revert` - Revertir migración

## 🚀 Despliegue

### Con Docker
```bash
docker-compose up -d
```

### Manual
```bash
npm run build
npm run start:prod
```

## 📚 Documentación

- **API**: `http://localhost:3000/api` (Swagger UI)
- **Frontend Admin**: Ver `README-FRONTEND-ADMIN.md`
- **Base de Datos**: Esquemas en `/src/database/migrations/`

## 🤝 Contribuir

1. Fork el proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -m 'feat: nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrir Pull Request

## 📝 Licencia

Proyecto bajo Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

---

**Desarrollado para GómezMarket** - Sistema de chatbot inteligente con integración completa WhatsApp y panel de administración avanzado.
