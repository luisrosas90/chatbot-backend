import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    @InjectRepository(User, 'users')
    private usersRepository: Repository<User>,
  ) {}

  async checkUsersDatabase(): Promise<boolean> {
    try {
      await this.usersRepository.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Error checking users database: ${error.message}`);
      return false;
    }
  }

  async checkAdminDatabase(): Promise<boolean> {
    try {
      await this.usersRepository.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(`Error checking admin database: ${error.message}`);
      return false;
    }
  }
} 