import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class TypedConfigService {
  constructor(private readonly inner: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.inner.get(key, { infer: true });
  }
}
