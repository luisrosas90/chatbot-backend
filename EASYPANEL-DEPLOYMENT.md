# 🚀 Guía de Despliegue en EasyPanel

Esta guía te ayudará a desplegar tu chatbot backend en EasyPanel paso a paso.

## 📋 Prerrequisitos

- ✅ Cuenta en EasyPanel
- ✅ Repositorio GitHub configurado ([https://github.com/luisrosas90/chatbot-backend](https://github.com/luisrosas90/chatbot-backend))
- ✅ Base de datos externa (Sistema Valery) accesible
- ✅ Claves API de WhatsApp Evolution API
- ✅ Claves API de OpenAI/DeepSeek

## 🏗️ Paso 1: Crear Proyecto en EasyPanel

1. **Iniciar sesión** en tu cuenta de EasyPanel
2. **Hacer clic en "New"** para crear un nuevo proyecto
3. **Nombrar el proyecto**: `chatbot-gomezmarket`
4. **Hacer clic en "Create"**

## 📱 Paso 2: Configurar App Service

1. **Dentro del proyecto**, hacer clic en **"+ Service"**
2. **Seleccionar "App"** como tipo de servicio
3. **Configurar el servicio**:
   - **Nombre**: `chatbot-backend`
   - **Fuente**: GitHub Repository

## 🔗 Paso 3: Configurar Repositorio GitHub

1. **En la pestaña "Source"**:
   - **Repository**: `luisrosas90/chatbot-backend`
   - **Branch**: `main`
   - **Auto Deploy**: ✅ Activar para despliegues automáticos

## 🐳 Paso 4: Configurar Build

1. **En la pestaña "Build"**:
   - **Build Method**: `Dockerfile`
   - **Dockerfile Path**: `./Dockerfile` (usar el Dockerfile existente)

## 🌐 Paso 5: Configurar Variables de Entorno

En la pestaña **"Environment"**, agregar las siguientes variables:

### Configuración del Servidor
```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=*
```

### Base de Datos (PostgreSQL recomendado)
```
DB_HOST=tu-host-db
DB_PORT=5432
DB_USERNAME=tu-usuario
DB_PASSWORD=tu-password-segura
DB_DATABASE=chatbot_db
```

### Base de Datos Externa (Sistema Valery)
```
EXTERNAL_DB_HOST=tu-host-valery
EXTERNAL_DB_PORT=3306
EXTERNAL_DB_USERNAME=usuario-valery
EXTERNAL_DB_PASSWORD=password-valery
EXTERNAL_DB_NAME=gomezmarket_sabaneta
```

### JWT
```
JWT_SECRET=tu-clave-jwt-super-segura-cambia-esto
JWT_EXPIRATION=24h
```

### WhatsApp Evolution API
```
EVOLUTION_API_URL=https://tu-evolution-api.com
EVOLUTION_API_KEY=tu-clave-evolution
WHATSAPP_INSTANCE=tu-instancia-whatsapp
```

### Inteligencia Artificial
```
AI_API_KEY=tu-clave-openai
OPENAI_MODEL=gpt-3.5-turbo
DEEPSEEK_API_KEY=tu-clave-deepseek-opcional
```

### Sistema Valery
```
VALERY_API_URL=tu-url-valery-api
VALERY_API_KEY=tu-clave-valery
VALERY_SYNC_INTERVAL=3600000
```

## 🌍 Paso 6: Configurar Dominio

1. **En la pestaña "Domains"**:
   - **Agregar dominio**: `tu-chatbot.tu-dominio.com`
   - **Puerto del proxy**: `3001`
   - **HTTPS**: ✅ Activar (automático con Let's Encrypt)

## 💾 Paso 7: Configurar Persistencia (Opcional)

Si necesitas persistir archivos:

1. **En la pestaña "Mounts"**:
   - **Tipo**: Volume
   - **Nombre**: `uploads`
   - **Mount Path**: `/app/uploads`

## 🚀 Paso 8: Desplegar

1. **Hacer clic en "Deploy"**
2. **Esperar a que el build termine** (2-5 minutos)
3. **Verificar logs** en la pestaña "Logs"

## ✅ Paso 9: Verificar Despliegue

### Health Check
```bash
curl https://tu-chatbot.tu-dominio.com/health
```

### Panel de Administración
```bash
https://tu-chatbot.tu-dominio.com/admin-dashboard.html
```

### API Documentation
```bash
https://tu-chatbot.tu-dominio.com/api
```

## 🔧 Configuración de Base de Datos

### Opción 1: PostgreSQL en EasyPanel

1. **Crear servicio PostgreSQL**:
   - Ir a "+ Service" → "Postgres"
   - Nombre: `chatbot-db`
   - Configurar credenciales

2. **Conectar con la app**:
   ```
   DB_HOST=$(PROJECT_NAME)-chatbot-db
   DB_PORT=5432
   ```

### Opción 2: Base de Datos Externa

Usar las credenciales de tu base de datos externa en las variables de entorno.

## 📊 Monitoreo y Logs

- **Logs en tiempo real**: Pestaña "Logs" en EasyPanel
- **Métricas**: Panel de administración interno
- **Health checks**: Endpoint `/health`

## 🔄 Auto-Deploy desde GitHub

Una vez configurado, cada push a la rama `main` disparará automáticamente un nuevo despliegue.

## 🛠️ Troubleshooting

### Error de Conexión a DB
```bash
# Verificar variables de entorno
# Comprobar conectividad de red
# Revisar logs de la aplicación
```

### Error de Build
```bash
# Verificar Dockerfile
# Comprobar dependencias en package.json
# Revisar logs de build
```

### Error de WhatsApp API
```bash
# Verificar credenciales Evolution API
# Comprobar conectividad
# Revisar configuración de webhook
```

## 📞 Soporte

- **Documentación EasyPanel**: [https://easypanel.io/docs](https://easypanel.io/docs)
- **GitHub Issues**: [https://github.com/luisrosas90/chatbot-backend/issues](https://github.com/luisrosas90/chatbot-backend/issues)

## 🎯 URLs Importantes Post-Despliegue

- **API Base**: `https://tu-dominio.com/api`
- **Panel Admin**: `https://tu-dominio.com/admin-dashboard.html`
- **Swagger Docs**: `https://tu-dominio.com/api`
- **Health Check**: `https://tu-dominio.com/health`
- **WhatsApp Webhook**: `https://tu-dominio.com/api/whatsapp/webhook`

¡Tu chatbot estará listo para usar! 🎉 