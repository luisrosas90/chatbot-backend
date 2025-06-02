import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('codigoCliente') codigoCliente: string,
  ) {
    try {
      const user = await this.authService.validateUser(email, codigoCliente);
      return this.authService.login(user);
    } catch (error) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }
} 