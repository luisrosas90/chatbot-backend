import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { DiscountsService } from './discounts.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { Promotion } from './entities/promotion.entity';
import { Discount } from './entities/discount.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion, Discount], 'users'),
    ScheduleModule.forRoot(),
    NotificationsModule,
  ],
  controllers: [PromotionsController],
  providers: [PromotionsService, DiscountsService],
  exports: [PromotionsService, DiscountsService],
})
export class PromotionsModule {} 