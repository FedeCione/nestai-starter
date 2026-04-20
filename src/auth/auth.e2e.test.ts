import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://fake:fake@localhost:5432/fake';
process.env.JWT_SECRET = 'test-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.JWT_EXPIRES_IN = '15m';
process.env.ALLOWED_ORIGINS = '';
process.env.RATE_LIMIT_MAX = '1000';

vi.mock('drizzle-orm', async () => {
  const actual =
    await vi.importActual<typeof import('drizzle-orm')>('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn((col: unknown, val: unknown) => ({ __op: 'eq', col, val })),
  };
});

import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import type { Env } from '../config/env.schema';
import { validateEnv } from '../config/env.schema';
import { DRIZZLE, type DrizzleDatabase } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

type FakeRow = { id: string; email: string; passwordHash: string };

const store = new Map<string, FakeRow>();

const pickFields = (row: FakeRow, cols: Record<string, unknown>) => {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(cols)) {
    out[key] = (row as Record<string, unknown>)[key];
  }
  return out;
};

const mockDb = {
  select: (cols: Record<string, unknown>) => ({
    from: () => ({
      where: (cond: { val: string }) => ({
        limit: () => {
          const user = [...store.values()].find((u) => u.email === cond.val);
          return Promise.resolve(user ? [pickFields(user, cols)] : []);
        },
      }),
    }),
  }),
  insert: () => ({
    values: (v: { email: string; passwordHash: string }) => ({
      returning: (cols: Record<string, unknown>) => {
        const id = `uuid-${store.size + 1}`;
        const row: FakeRow = {
          id,
          email: v.email,
          passwordHash: v.passwordHash,
        };
        store.set(id, row);
        return Promise.resolve([pickFields(row, cols)]);
      },
    }),
  }),
} as unknown as DrizzleDatabase;

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          validate: validateEnv,
        }),
        PassportModule,
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            secret: config.get('JWT_SECRET', { infer: true }),
            signOptions: {
              expiresIn: config.get('JWT_EXPIRES_IN', { infer: true }),
            },
          }),
        }),
      ],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: APP_FILTER, useClass: HttpExceptionFilter },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    store.clear();
  });

  it('POST /auth/register returns 201 with an access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'alice@example.com', password: 'password1' })
      .expect(201);
    const body = res.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
    expect(body.accessToken.length).toBeGreaterThan(10);
  });

  it('POST /auth/register twice on the same email → 409 email_taken', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'password1' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'bob@example.com', password: 'password1' })
      .expect(409);
    expect(res.body).toEqual({ error: 'email_taken' });
  });

  it('POST /auth/register with an invalid payload → 400 invalid_payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
    const body = res.body as { error: string; details: unknown };
    expect(body.error).toBe('invalid_payload');
    expect(Array.isArray(body.details)).toBe(true);
  });

  it('POST /auth/login with correct credentials → 200', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'carol@example.com', password: 'password1' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'carol@example.com', password: 'password1' })
      .expect(200);
    const body = res.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
  });

  it('POST /auth/login with the wrong password → 401 invalid_credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dave@example.com', password: 'password1' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'dave@example.com', password: 'wrongpass' })
      .expect(401);
    expect(res.body).toEqual({ error: 'invalid_credentials' });
  });

  it('GET /auth/me without a token → 401 unauthorized', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(res.body).toEqual({ error: 'unauthorized' });
  });

  it('GET /auth/me with a valid token returns the user', async () => {
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'eve@example.com', password: 'password1' })
      .expect(201);

    const token = (reg.body as { accessToken: string }).accessToken;
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const body = res.body as { id: string; email: string };
    expect(body.email).toBe('eve@example.com');
    expect(typeof body.id).toBe('string');
  });
});
