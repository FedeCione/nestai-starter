import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DrizzleDatabase } from '../database/database.module';
import { AuthService } from './auth.service';

type Chain = {
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
};

const makeChain = (result: unknown): Chain => {
  const chain = {} as Chain;
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.values = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve(result));
  return chain;
};

describe('AuthService', () => {
  let service: AuthService;
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
  let jwt: { signAsync: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
    };
    jwt = {
      signAsync: vi.fn().mockResolvedValue('test-token'),
    };
    service = new AuthService(
      db as unknown as DrizzleDatabase,
      jwt as unknown as JwtService,
    );
  });

  describe('register', () => {
    it('hashes the password and returns an access token on a fresh email', async () => {
      db.select.mockReturnValue(makeChain([]));
      const insertChain = makeChain([
        { id: 'uuid-1', email: 'alice@example.com' },
      ]);
      db.insert.mockReturnValue(insertChain);

      const result = await service.register({
        email: 'alice@example.com',
        password: 'password1',
      });

      expect(result).toEqual({ accessToken: 'test-token' });

      expect(insertChain.values).toHaveBeenCalledTimes(1);
      const insertArg = insertChain.values.mock.calls[0][0] as {
        email: string;
        passwordHash: string;
      };
      expect(insertArg.email).toBe('alice@example.com');
      expect(insertArg.passwordHash).not.toBe('password1');
      expect(await bcrypt.compare('password1', insertArg.passwordHash)).toBe(
        true,
      );

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'uuid-1',
        email: 'alice@example.com',
      });
    });

    it('throws ConflictException when the email already exists', async () => {
      db.select.mockReturnValue(makeChain([{ id: 'existing' }]));

      await expect(
        service.register({
          email: 'alice@example.com',
          password: 'password1',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(db.insert).not.toHaveBeenCalled();
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns a token on the correct password', async () => {
      const passwordHash = await bcrypt.hash('password1', 10);
      db.select.mockReturnValue(
        makeChain([{ id: 'uuid-1', email: 'alice@example.com', passwordHash }]),
      );

      const result = await service.login({
        email: 'alice@example.com',
        password: 'password1',
      });

      expect(result).toEqual({ accessToken: 'test-token' });
      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: 'uuid-1',
        email: 'alice@example.com',
      });
    });

    it('throws UnauthorizedException when the user is not found', async () => {
      db.select.mockReturnValue(makeChain([]));

      await expect(
        service.login({ email: 'alice@example.com', password: 'password1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException on a wrong password', async () => {
      const passwordHash = await bcrypt.hash('password1', 10);
      db.select.mockReturnValue(
        makeChain([{ id: 'uuid-1', email: 'alice@example.com', passwordHash }]),
      );

      await expect(
        service.login({ email: 'alice@example.com', password: 'wrong-pw' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
    });
  });
});
