import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorador personalizado para manejar archivos subidos con Express
 * Facilita el acceso al archivo desde los controladores
 */
export const UploadedExpressFile = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const file = request.file;
    
    if (!file) {
      return null;
    }
    
    return file;
  },
); 