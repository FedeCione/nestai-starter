import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorBody = { error: string; details?: unknown; resetIn?: number };

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const body = this.normalize(response, status);
      res.status(status).json(body);
      return;
    }

    this.logger.error(
      `Unhandled error on ${req.method} ${req.url}`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'internal_error' });
  }

  private normalize(response: unknown, status: number): ErrorBody {
    if (typeof response === 'string') {
      return { error: this.codeFromStatus(status), details: response };
    }
    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      if (typeof obj.error === 'string') return obj as ErrorBody;
      const message = obj.message;
      return {
        error: this.codeFromStatus(status),
        details: message ?? obj,
      };
    }
    return { error: this.codeFromStatus(status) };
  }

  private codeFromStatus(status: number): string {
    switch (status) {
      case 400:
        return 'invalid_payload';
      case 401:
        return 'unauthorized';
      case 403:
        return 'forbidden';
      case 404:
        return 'not_found';
      case 409:
        return 'conflict';
      case 429:
        return 'rate_limited';
      case 503:
        return 'service_unavailable';
      default:
        return 'error';
    }
  }
}
