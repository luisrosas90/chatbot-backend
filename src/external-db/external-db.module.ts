import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalDbService } from './external-db.service';

@Module({
  imports: [TypeOrmModule.forFeature([], 'externa')],
  providers: [ExternalDbService],
  exports: [ExternalDbService],
})
export class ExternalDbModule {} 