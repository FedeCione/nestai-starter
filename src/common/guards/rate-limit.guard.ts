import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env.schema';
import { getClientIp } from '../helpers/get-client-ip';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const windowMs = this.config.get('RATE_LIMIT_WINDOW_MS', { infer: true });
    const max = this.config.get('RATE_LIMIT_MAX', { infer: true });
    const key = this.identity(req);
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.gc(now);
      return true;
    }

    if (bucket.count >= max) {
      const resetIn = Math.ceil((bucket.resetAt - now) / 1000);
      throw new HttpException(
        { error: 'rate_limited', resetIn },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }

  private identity(req: Request): string {
    const user = (req as Request & { user?: { id?: string } }).user;
    if (user?.id) return `uid:${user.id}`;
    return `ip:${getClientIp(req)}`;
  }

  private gc(now: number) {
    if (this.buckets.size < 1024) return;
    for (const [k, b] of this.buckets) {
      if (b.resetAt <= now) this.buckets.delete(k);
    }
  }
}
