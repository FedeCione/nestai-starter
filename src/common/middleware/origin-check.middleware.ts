import {
  HttpException,
  HttpStatus,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from '../../config/env.schema';

@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: string[];

  constructor(config: ConfigService<Env, true>) {
    this.allowed = config
      .get('ALLOWED_ORIGINS', { infer: true })
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  use(req: Request, _res: Response, next: NextFunction) {
    if (this.allowed.length === 0) return next();
    const origin = req.headers.origin;
    if (!origin) return next();
    try {
      const host = new URL(origin).host;
      const ok = this.allowed.some((o) => {
        try {
          return new URL(o).host === host;
        } catch {
          return false;
        }
      });
      if (!ok)
        throw new HttpException({ error: 'forbidden' }, HttpStatus.FORBIDDEN);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException({ error: 'forbidden' }, HttpStatus.FORBIDDEN);
    }
    return next();
  }
}
