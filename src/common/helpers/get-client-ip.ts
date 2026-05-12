import type { Request } from 'express';

export function getClientIp(req: Request): string {
  return req.ip ?? 'unknown';
}
