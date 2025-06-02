import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { CartsService } from './carts.service';
import { CartsController } from './carts.controller';
import { ShoppingCart } from '../chat/entities/shopping-cart.entity';
import { PersistentSession } from '../chat/entities/persistent-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingCart, PersistentSession], 'users'),
    ScheduleModule.forRoot(),
  ],
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule {} 