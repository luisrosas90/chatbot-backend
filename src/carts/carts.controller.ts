import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { CartsService, AbandonedCartData, CartRecoveryStats } from './carts.service';

@Controller('api/carts')
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('abandoned')
  async getAbandonedCarts(
    @Query('hours') hours?: number
  ): Promise<AbandonedCartData[]> {
    const hoursThreshold = hours ? parseInt(hours.toString()) : 24;
    return await this.cartsService.findAbandonedCarts(hoursThreshold);
  }

  @Get('recovery-stats')
  async getRecoveryStats(): Promise<CartRecoveryStats> {
    return await this.cartsService.getCartRecoveryStats();
  }

  @Post('recover/:sessionId')
  async markAsRecovered(@Param('sessionId') sessionId: string): Promise<{ success: boolean }> {
    const result = await this.cartsService.markCartAsRecovered(sessionId);
    return { success: result };
  }

  @Get('recovery-message/:sessionId')
  async getRecoveryMessage(@Param('sessionId') sessionId: string): Promise<{ message: string }> {
    const abandonedCarts = await this.cartsService.findAbandonedCarts();
    const cart = abandonedCarts.find(c => c.sessionId === sessionId);
    
    if (!cart) {
      return { message: 'Carrito no encontrado' };
    }
    
    const message = this.cartsService.generateRecoveryMessage(cart);
    return { message };
  }
} 