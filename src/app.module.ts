/**
 * Módulo principal de la aplicación.
 * Este módulo configura:
 * - Conexiones a bases de datos
 * - Variables de entorno
 * - Módulos de la aplicación
 * - Configuración global
 * 
 * @module AppModule
 */
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { AiModule } from './ai/ai.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { CartsModule } from './carts/carts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExternalDbModule } from './external-db/external-db.module';
import { HealthModule } from './health/health.module';
import { User } from './users/entities/user.entity';
import { ChatModule } from './chat/chat.module';
import { ChatSession } from './chat/entities/chat-session.entity';
import { ChatMessage } from './chat/entities/message.entity';
import { PersistentSession } from './chat/entities/persistent-session.entity';
import { SearchHistory } from './chat/entities/search-history.entity';
import { ShoppingCart } from './chat/entities/shopping-cart.entity';
import { MessageTemplate } from './chat/entities/message-template.entity';
import { ValeryModule } from './valery/valery.module';
import { Product } from './products/entities/product.entity';
import { Invoice } from './invoices/entities/invoice.entity';
import { Chatbot } from './admin/entities/chatbot.entity';
import { Conversation } from './admin/entities/conversation.entity';
import { AdminMessage } from './admin/entities/message.entity';
import { Promotion } from './promotions/entities/promotion.entity';
import { Discount } from './promotions/entities/discount.entity';
import { Order } from './orders/entities/order.entity';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';
import { AdminModule } from './admin/admin.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      name: 'users',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const usersDbConfig = configService.get('database.users');
        if (!usersDbConfig) {
          throw new Error('No se encontró la configuración de database.users');
        }
        return {
          name: 'users',
          type: usersDbConfig.type,
          host: usersDbConfig.host,
          port: usersDbConfig.port,
          username: usersDbConfig.username,
          password: usersDbConfig.password,
          database: usersDbConfig.database,
          entities: [
            User,
            ChatSession,
            ChatMessage,
            PersistentSession,
            SearchHistory,
            ShoppingCart,
            MessageTemplate,
            Product,
            Invoice,
            Chatbot,
            Conversation,
            AdminMessage,
            Promotion,
            Discount,
            Order
          ],
          synchronize: configService.get('nodeEnv') !== 'production',
          retryAttempts: usersDbConfig.retryAttempts,
          retryDelay: usersDbConfig.retryDelay,
          ssl: usersDbConfig.ssl,
          autoLoadEntities: false,
          logging: configService.get('nodeEnv') === 'development',
        };
      },
      inject: [ConfigService],
    }),
    // Base de datos externa (opcional)
    ...(process.env.EXTERNAL_DB_HOST ? [
      TypeOrmModule.forRootAsync({
        name: 'externa',
        imports: [ConfigModule],
        useFactory: async (configService: ConfigService) => {
          const externaDbConfig = configService.get('database.externa');
          if (!externaDbConfig) {
            console.warn('⚠️ Configuración de base de datos externa no encontrada - continuando sin conexión externa');
            return null;
          }
          
          try {
            return {
              name: 'externa',
              type: externaDbConfig.type,
              host: externaDbConfig.host,
              port: externaDbConfig.port,
              username: externaDbConfig.username,
              password: externaDbConfig.password,
              database: externaDbConfig.database,
              entities: [],
              synchronize: false, // No sincronizar - solo lectura
              retryAttempts: 1, // Reducir reintentos para startup más rápido
              retryDelay: 1000,
              ssl: externaDbConfig.ssl,
              logging: configService.get('nodeEnv') === 'development',
            };
          } catch (error) {
            console.warn('⚠️ Error configurando base de datos externa:', error.message);
            return null;
          }
        },
        inject: [ConfigService],
      })
    ] : []),
    UsersModule,
    AuthModule,
    WhatsappModule,
    AiModule,
    OrdersModule,
    PaymentsModule,
    CartsModule,
    NotificationsModule,
    // Solo incluir ExternalDbModule si la conexión está disponible
    ...(process.env.EXTERNAL_DB_HOST ? [ExternalDbModule] : []),
    HealthModule,
    ChatModule,
    ValeryModule,
    ProductsModule,
    PromotionsModule,
    AdminModule,
    ReportsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 