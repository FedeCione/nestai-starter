import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

describe('ZodValidationPipe', () => {
  it('returns the parsed value on valid input', () => {
    const pipe = new ZodValidationPipe(userSchema);
    const value = pipe.transform({
      email: 'alice@example.com',
      password: 'password1',
    });
    expect(value).toEqual({
      email: 'alice@example.com',
      password: 'password1',
    });
  });

  it('throws BadRequestException with invalid_payload on failure', () => {
    const pipe = new ZodValidationPipe(userSchema);
    expect(() =>
      pipe.transform({ email: 'not-an-email', password: 'x' }),
    ).toThrow(BadRequestException);
  });

  it('emits a details array describing each issue', () => {
    const pipe = new ZodValidationPipe(userSchema);
    try {
      pipe.transform({ email: 'nope', password: 'x' });
      expect.fail('pipe should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const body = (err as BadRequestException).getResponse() as {
        error: string;
        details: Array<{ path: string; message: string }>;
      };
      expect(body.error).toBe('invalid_payload');
      expect(Array.isArray(body.details)).toBe(true);
      expect(body.details.length).toBeGreaterThanOrEqual(2);
      const paths = body.details.map((d) => d.path);
      expect(paths).toContain('email');
      expect(paths).toContain('password');
    }
  });
});
