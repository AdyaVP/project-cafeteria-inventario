import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

// Convierte errores de Mongoose (CastError, E11000 duplicate key,
// ValidationError) a excepciones HTTP legibles antes del cliente.
function esErrorMongoose(error: unknown): error is MongooseError & {
  code?: number;
} {
  return error instanceof MongooseError || error instanceof Error;
}

function esDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      const message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message ??
            exception.message;

      response.status(status).json({
        success: false,
        statusCode: status,
        message,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    if (esDuplicateKey(exception)) {
      response.status(HttpStatus.CONFLICT).json({
        success: false,
        statusCode: HttpStatus.CONFLICT,
        message: 'Ya existe un registro con esos datos',
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    if (exception instanceof MongooseError.CastError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: `El id "${exception.value}" no es un ObjectId válido`,
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    if (exception instanceof MongooseError.ValidationError) {
      const fields = Object.entries(exception.errors).map(
        ([campo, error]) => `${campo}: ${error.message}`,
      );

      response.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        statusCode: HttpStatus.BAD_REQUEST,
        message: fields.join(', '),
        timestamp: new Date().toISOString(),
        path: request.url,
      });
      return;
    }

    const esErrorConocido =
      esErrorMongoose(exception) &&
      exception.message !== undefined &&
      typeof exception.message === 'string';

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: esErrorConocido
        ? exception.message
        : 'Internal server error',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
