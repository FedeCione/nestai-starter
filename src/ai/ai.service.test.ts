import { ServiceUnavailableException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../config/env.schema';
import type { DrizzleDatabase } from '../database/database.module';
import { AiService } from './ai.service';

const chatCreateMock = vi.fn();

vi.mock('groq-sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: chatCreateMock } },
  })),
}));

const makeConfig = (apiKey: string | undefined): ConfigService<Env, true> =>
  ({
    get: vi.fn((key: string) => {
      if (key === 'GROQ_API_KEY') return apiKey;
      if (key === 'GROQ_MODEL') return 'llama-3.3-70b-versatile';
      return undefined;
    }),
  }) as unknown as ConfigService<Env, true>;

const makeDb = () => {
  const values = vi.fn().mockResolvedValue(undefined);
  const insert = vi.fn(() => ({ values }));
  const limit = vi.fn().mockResolvedValue([]);
  const orderBy = vi.fn(() => ({ limit }));
  const where = vi.fn(() => ({ orderBy }));
  const from = vi.fn(() => ({ where }));
  const select = vi.fn(() => ({ from }));
  return {
    db: { insert, select } as unknown as DrizzleDatabase,
    insert,
    values,
    select,
    from,
    where,
    orderBy,
    limit,
  };
};

describe('AiService', () => {
  beforeEach(() => {
    chatCreateMock.mockReset();
  });

  describe('demo mode (no GROQ_API_KEY)', () => {
    it('returns the canned response and persists a generation row', async () => {
      const { db, insert, values } = makeDb();
      const service = new AiService(db, makeConfig(undefined));

      const result = await service.generate('user-1', 'hola');

      expect(result.model).toBe('demo');
      expect(result.tokensUsed).toBe(0);
      expect(result.response).toContain('[DEMO MODE]');
      expect(insert).toHaveBeenCalledTimes(1);
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          prompt: 'hola',
          model: 'demo',
          tokensUsed: 0,
        }),
      );
      expect(chatCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('live mode', () => {
    it('calls Groq, persists the generation, and returns the shaped response', async () => {
      chatCreateMock.mockResolvedValue({
        choices: [{ message: { content: 'hola mundo' } }],
        usage: { total_tokens: 42 },
      });

      const { db, insert, values } = makeDb();
      const service = new AiService(db, makeConfig('gsk_test_key'));

      const result = await service.generate('user-1', 'hola');

      expect(chatCreateMock).toHaveBeenCalledTimes(1);
      const request = chatCreateMock.mock.calls[0][0] as {
        model: string;
        temperature: number;
        messages: Array<{ role: string; content: string }>;
      };
      expect(request.model).toBe('llama-3.3-70b-versatile');
      expect(request.messages[0].role).toBe('system');
      expect(request.messages[1]).toEqual({ role: 'user', content: 'hola' });

      expect(result).toEqual({
        response: 'hola mundo',
        model: 'llama-3.3-70b-versatile',
        tokensUsed: 42,
      });
      expect(insert).toHaveBeenCalledTimes(1);
      expect(values).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          prompt: 'hola',
          response: 'hola mundo',
          model: 'llama-3.3-70b-versatile',
          tokensUsed: 42,
        }),
      );
    });

    it('throws ServiceUnavailableException when Groq fails', async () => {
      chatCreateMock.mockRejectedValue(new Error('boom'));

      const { db, insert } = makeDb();
      const service = new AiService(db, makeConfig('gsk_test_key'));

      await expect(service.generate('user-1', 'hola')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(insert).not.toHaveBeenCalled();
    });
  });
});
