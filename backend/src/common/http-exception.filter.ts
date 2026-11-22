import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const multerCode = this.getMulterCode(exception);
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : multerCode === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : multerCode
            ? HttpStatus.BAD_REQUEST
            : HttpStatus.INTERNAL_SERVER_ERROR;
    const message =
      exception instanceof HttpException
        ? exception.message
        : multerCode === 'LIMIT_FILE_SIZE'
          ? 'Plik przekracza dozwolony rozmiar 10 MB.'
          : multerCode
            ? 'Nie udało się przetworzyć przesłanego pliku.'
            : 'Wewnętrzny błąd serwera';

    response.status(status).json({
      statusCode: status,
      message,
      error: exception instanceof HttpException
        ? exception.name
        : multerCode
          ? 'BadRequest'
          : 'InternalServerError',
      timestamp: new Date().toISOString(),
    });
  }

  private getMulterCode(exception: unknown): string | null {
    if (
      typeof exception === 'object' &&
      exception !== null &&
      'code' in exception &&
      typeof exception.code === 'string' &&
      exception.code.startsWith('LIMIT_')
    ) {
      return exception.code;
    }
    return null;
  }
}
