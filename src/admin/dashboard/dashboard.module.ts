import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ReportsModule } from '../../reports/reports.module';
import { PromotionsModule } from '../../promotions/promotions.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { WhatsappModule } from '../../whatsapp/whatsapp.module';

@Module({
  imports: [
    ReportsModule,
    PromotionsModule,
    NotificationsModule,
    WhatsappModule
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService]
})
export class DashboardModule {} 