import { z } from 'zod';

export const generateRequestSchema = z.object({
  prompt: z.string().min(1).max(4000),
});

export type GenerateRequestDto = z.infer<typeof generateRequestSchema>;

export const generateRequestOpenApi = {
  type: 'object',
  required: ['prompt'],
  properties: {
    prompt: {
      type: 'string',
      minLength: 1,
      maxLength: 4000,
      example: 'Write a one-paragraph explainer about Drizzle ORM.',
    },
  },
};

export const generateResponseSchema = z.object({
  response: z.string(),
  model: z.string(),
  tokensUsed: z.number().nullable(),
});

export type GenerateResponseDto = z.infer<typeof generateResponseSchema>;

export const generateResponseOpenApi = {
  type: 'object',
  required: ['response', 'model', 'tokensUsed'],
  properties: {
    response: { type: 'string' },
    model: { type: 'string', example: 'llama-3.3-70b-versatile' },
    tokensUsed: { type: 'integer', nullable: true, example: 128 },
  },
};

export const generationSummarySchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  response: z.string(),
  model: z.string(),
  tokensUsed: z.number().nullable(),
  createdAt: z.string().datetime(),
});

export type GenerationSummaryDto = z.infer<typeof generationSummarySchema>;

export const generationSummaryOpenApi = {
  type: 'object',
  required: [
    'id',
    'prompt',
    'response',
    'model',
    'tokensUsed',
    'createdAt',
  ],
  properties: {
    id: { type: 'string', format: 'uuid' },
    prompt: { type: 'string' },
    response: { type: 'string' },
    model: { type: 'string' },
    tokensUsed: { type: 'integer', nullable: true },
    createdAt: { type: 'string', format: 'date-time' },
  },
};

export const generationSummaryListOpenApi = {
  type: 'array',
  items: generationSummaryOpenApi,
};
