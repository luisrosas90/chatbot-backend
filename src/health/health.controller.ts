import { Controller, Get, Logger } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkHealth() {
    const usersDbStatus = await this.healthService.checkUsersDatabase();
    const adminDbStatus = await this.healthService.checkAdminDatabase();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      databases: {
        users: usersDbStatus ? 'connected' : 'disconnected',
        admin: adminDbStatus ? 'connected' : 'disconnected',
      },
    };
  }
} 