import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ValeryService } from './valery.service';
import { ValeryDbService } from './valery-db.service';
import { ValeryChatbotService } from './valery-chatbot.service';
import { ChatModule } from '../chat/chat.module';
import { ExternalDbModule } from '../external-db/external-db.module';
import { Product } from '../products/entities/product.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { User } from '../users/entities/user.entity';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => ChatModule),
    ExternalDbModule,
    TypeOrmModule.forFeature([
      Product,
      Invoice,
      User
    ], 'users'),
    ProductsModule
  ],
  providers: [
    ValeryService,
    ValeryDbService,
    ValeryChatbotService,
  ],
  exports: [
    ValeryService,
    ValeryDbService,
    ValeryChatbotService,
  ],
})
export class ValeryModule {} 