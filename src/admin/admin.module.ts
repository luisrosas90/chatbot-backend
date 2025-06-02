import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';
import { ChatbotService } from './services/chatbot.service';
import { ConversationService } from './services/conversation.service';
import { PromotionService } from './services/promotion.service';
import { ReportService } from './services/report.service';
import { CartsModule } from '../carts/carts.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { ExternalDbModule } from '../external-db/external-db.module';
import { PersistentSession } from '../chat/entities/persistent-session.entity';
import { ChatMessage } from '../chat/entities/message.entity';
import { SearchHistory } from '../chat/entities/search-history.entity';
import { ShoppingCart } from '../chat/entities/shopping-cart.entity';
import { Discount } from '../promotions/entities/discount.entity';
import { Chatbot } from './entities/chatbot.entity';
import { Conversation } from './entities/conversation.entity';
import { AdminMessage } from './entities/message.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Promotion } from '../promotions/entities/promotion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersistentSession,
      ChatMessage,
      SearchHistory,
      ShoppingCart,
      Discount,
      Chatbot,
      Conversation,
      AdminMessage,
      User,
      Order,
      Promotion
    ], 'users'),
    CartsModule,
    PromotionsModule,
    NotificationsModule,
    WhatsappModule,
    ExternalDbModule,
  ],
  controllers: [AdminController],
  providers: [
    AdminService,
    ChatbotService,
    ConversationService,
    PromotionService,
    ReportService,
  ],
  exports: [AdminService],
})
export class AdminModule {} 