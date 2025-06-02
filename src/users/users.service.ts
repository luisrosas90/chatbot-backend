import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User, 'users')
    private usersRepository: Repository<User>
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    try {
      const user = this.usersRepository.create(createUserDto);
      return await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error(`Error al crear usuario: ${error.message}`);
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
    }
    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.findOne(id);
      Object.assign(user, updateUserDto);
      return await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error(`Error al actualizar usuario: ${error.message}`);
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findByPhone(phone: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { phone } });
    if (!user) {
      throw new NotFoundException(`Usuario con teléfono ${phone} no encontrado`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(`Usuario con email ${email} no encontrado`);
    }
    return user;
  }

  async findByCodigoCliente(codigoCliente: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { codigoCliente } });
    if (!user) {
      throw new NotFoundException(`Usuario con código de cliente ${codigoCliente} no encontrado`);
    }
    return user;
  }

  async getClienteInfo(id: string): Promise<any> {
    try {
      const user = await this.findOne(id);
      return {
        id: user.id,
        codigoCliente: user.codigoCliente,
        name: user.name,
        email: user.email,
        phone: user.phone,
        direccion: user.direccion,
        saldo: user.saldo,
        isActive: user.isActive
      };
    } catch (error) {
      this.logger.error(`Error al obtener información del cliente: ${error.message}`);
      throw error;
    }
  }

  async validateUser(email: string, codigoCliente: string): Promise<User | null> {
    try {
      const user = await this.findByEmail(email);
      if (user && user.codigoCliente === codigoCliente) {
        return user;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error al validar usuario: ${error.message}`);
      return null;
    }
  }
} 