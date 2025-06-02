import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';
import { UnsupportedMediaTypeException } from '@nestjs/common';

// Tipos de archivos permitidos
const allowedFileTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Configuración para el almacenamiento de archivos
export const fileStorage = {
  storage: diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = process.env.UPLOAD_DIR || 'uploads';
      
      // Crear directorio si no existe
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generar nombre único para el archivo
      const filename = `${Date.now()}-${randomUUID()}`;
      const extension = path.extname(file.originalname);
      cb(null, `${filename}${extension}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    // Validar tipo de archivo
    if (allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new UnsupportedMediaTypeException(`Tipo de archivo no permitido: ${file.mimetype}`), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
};

// Exportar interceptor configurado
export const MediaFileInterceptor = (fieldName: string) => {
  return FileInterceptor(fieldName, fileStorage);
}; 