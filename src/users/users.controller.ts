import { Controller, Get, Post, Body, Param, Put, Delete, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiResponse({ status: 201, description: 'Usuario creado exitosamente' })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @ApiResponse({ status: 200, description: 'Lista de usuarios obtenida exitosamente' })
  async findAll() {
    return await this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un usuario por ID' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado exitosamente' })
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario actualizado exitosamente' })
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return await this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un usuario' })
  @ApiResponse({ status: 200, description: 'Usuario eliminado exitosamente' })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'Usuario eliminado exitosamente' };
  }

  @Get('validate/:email/:codigoCliente')
  @ApiOperation({ summary: 'Validar usuario por email y código de cliente' })
  @ApiResponse({ status: 200, description: 'Usuario validado exitosamente' })
  async validateUser(
    @Param('email') email: string,
    @Param('codigoCliente') codigoCliente: string
  ) {
    return await this.usersService.validateUser(email, codigoCliente);
  }

  @Get('cliente/:id')
  @ApiOperation({ summary: 'Obtener información de cliente' })
  @ApiResponse({ status: 200, description: 'Información de cliente obtenida exitosamente' })
  async getClienteInfo(@Param('id') id: string) {
    return await this.usersService.getClienteInfo(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-email/:email')
  @ApiOperation({ summary: 'Buscar usuario por email' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado exitosamente' })
  async findByEmail(@Param('email') email: string) {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        return { found: false, message: 'Cliente no encontrado' };
      }
      return { found: true, user };
    } catch (error) {
      this.logger.error(`Error finding user by email: ${error.message}`);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('by-codigo/:codigoCliente')
  @ApiOperation({ summary: 'Buscar usuario por código de cliente' })
  @ApiResponse({ status: 200, description: 'Usuario encontrado exitosamente' })
  async findByCodigoCliente(@Param('codigoCliente') codigoCliente: string) {
    try {
      const user = await this.usersService.findByCodigoCliente(codigoCliente);
      if (!user) {
        return { found: false, message: 'Cliente no encontrado' };
      }
      return { found: true, user };
    } catch (error) {
      this.logger.error(`Error finding user by codigoCliente: ${error.message}`);
      throw error;
    }
  }
} 