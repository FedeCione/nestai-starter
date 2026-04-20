import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(72),
});

export type CredentialsDto = z.infer<typeof credentialsSchema>;

export const credentialsOpenApi = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
      maxLength: 254,
      example: 'alice@example.com',
    },
    password: {
      type: 'string',
      minLength: 8,
      maxLength: 72,
      example: 'password1',
    },
  },
};

export const tokenResponseSchema = z.object({
  accessToken: z.string(),
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;

export const tokenResponseOpenApi = {
  type: 'object',
  required: ['accessToken'],
  properties: {
    accessToken: {
      type: 'string',
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  },
};

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;

export const userResponseOpenApi = {
  type: 'object',
  required: ['id', 'email'],
  properties: {
    id: {
      type: 'string',
      format: 'uuid',
      example: '6f1e9d8c-2b3a-4c5d-8e9f-0a1b2c3d4e5f',
    },
    email: {
      type: 'string',
      format: 'email',
      example: 'alice@example.com',
    },
  },
};

export const errorResponseOpenApi = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' },
    details: {},
  },
};
