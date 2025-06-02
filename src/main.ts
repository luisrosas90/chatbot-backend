/**
 * Punto de entrada principal de la aplicación.
 * Este archivo configura:
 * - El servidor NestJS
 * - Middleware global
 * - Configuración de CORS
 * - Manejo de errores
 * - Documentación Swagger
 * 
 * @file main.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { WinstonModule } from 'nest-winston';
import { format, transports } from 'winston';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  // Crear directorio de logs si no existe
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }

  // Configurar Winston logger
  const logger = WinstonModule.createLogger({
    transports: [
      new transports.Console({
        format: format.combine(
          format.timestamp(),
          format.colorize(),
          format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level}]: ${message}`;
          })
        ),
      }),
      new transports.File({
        filename: path.join(logDir, 'whatsapp.log'),
        format: format.combine(
          format.timestamp(),
          format.json(),
        ),
      }),
    ],
  });

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    {
      logger,
    }
  );
  
  const configService = app.get(ConfigService);

  // Configurar carpeta para archivos estáticos
  const uploadDir = configService.get('UPLOAD_DIR', 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads',
  });

  // Habilitar CORS
  app.enableCors({
    origin: configService.get('CORS_ORIGIN', '*'),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

  // Habilitar validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('Chatbot SaaS API')
    .setDescription('API para el sistema de Chatbot SaaS')
    .setVersion('1.0')
    .addTag('whatsapp', 'Endpoints para integración con WhatsApp')
    .addTag('chat', 'Endpoints para gestión de conversaciones')
    .addTag('promotions', 'Endpoints para gestión de promociones')
    .addTag('notifications', 'Endpoints para gestión de notificaciones')
    .addTag('reports', 'Endpoints para generación de reportes')
    .addTag('admin', 'Endpoints para administración del sistema')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Chatbot SaaS - API Documentation',
    customfavIcon: 'https://avatars.githubusercontent.com/u/6936373?s=200&v=4',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.css',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css',
    ],
  });

  // Iniciar servidor
  const port = configService.get('PORT', 3001);
  await app.listen(port, '0.0.0.0');
  
  logger.log(`Aplicación corriendo en: http://localhost:${port}`);
  logger.log(`Base de datos principal (admin): ${configService.get('database.admin.host')}:${configService.get('database.admin.port')}/${configService.get('database.admin.database')}`);
}
bootstrap(); 