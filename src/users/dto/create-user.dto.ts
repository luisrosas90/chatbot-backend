import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'Nombre del usuario' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email del usuario' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contraseña del usuario' })
  @IsString()
  password: string;

  @ApiProperty({ description: 'Teléfono del usuario', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ description: 'Código de cliente', required: false })
  @IsString()
  @IsOptional()
  codigoCliente?: string;

  @ApiProperty({ description: 'Estado del usuario', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ description: 'Saldo del usuario', required: false })
  @IsNumber()
  @IsOptional()
  saldo?: number;

  @ApiProperty({ description: 'Dirección del usuario', required: false })
  @IsString()
  @IsOptional()
  direccion?: string;
} 