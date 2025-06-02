import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, codigoCliente: string): Promise<any> {
    const user = await this.usersService.validateUser(email, codigoCliente);
    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }
    return user;
  }

  async login(user: any) {
    const payload = { 
      email: user.email, 
      sub: user.idcliente,
      codigoCliente: user.codigoCliente 
    };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.idcliente,
        email: user.email,
        nombre: user.nombre,
        codigoCliente: user.codigoCliente
      }
    };
  }
} 