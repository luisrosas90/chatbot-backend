import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([], 'admin')],
  providers: [],
  exports: [],
})
export class PaymentsModule {} 