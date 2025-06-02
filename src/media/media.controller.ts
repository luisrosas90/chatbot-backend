import { Controller, Post, Get, Body, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { MediaFileInterceptor } from './interceptors/file.interceptor';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Subir un archivo multimedia' })
  @ApiResponse({ status: 201, description: 'Archivo subido exitosamente' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(MediaFileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    try {
      const result = await this.mediaService.uploadFile(file);
      return result;
    } catch (error) {
      this.logger.error(`Error al subir archivo: ${error.message}`);
      throw error;
    }
  }

  @Get('types')
  @ApiOperation({ summary: 'Obtener tipos de archivos permitidos' })
  @ApiResponse({ status: 200, description: 'Tipos de archivos obtenidos' })
  getAllowedTypes() {
    return this.mediaService.getAllowedTypes();
  }
} 