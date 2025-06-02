# Etapa de construcción
FROM node:18-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluidas dev) para el build
RUN npm ci && npm cache clean --force

# Copiar código fuente
COPY . .

# Construir la aplicación
RUN npm run build

# Etapa de producción
FROM node:18-alpine AS production

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nestjs -u 1001

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar aplicación compilada
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copiar archivos estáticos necesarios
COPY --from=builder --chown=nestjs:nodejs /app/admin-dashboard.html ./
COPY --from=builder --chown=nestjs:nodejs /app/admin-dashboard-extended.html ./

# Crear directorios necesarios
RUN mkdir -p logs uploads temp && \
    chown -R nestjs:nodejs logs uploads temp

# Cambiar a usuario no-root
USER nestjs

# Exponer puerto (será leído desde ENV)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node --version || exit 1

# Comando de inicio
CMD ["npm", "run", "start:prod"] 