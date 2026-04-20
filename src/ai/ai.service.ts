import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { desc, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import type { Env } from '../config/env.schema';
import { DRIZZLE, type DrizzleDatabase } from '../database/database.module';
import { generations } from '../database/schema';
import type { GenerateResponseDto, GenerationSummaryDto } from './dto/ai.dto';
import { SYSTEM_PROMPT } from './lib/system-prompt';

const HISTORY_LIMIT = 20;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Groq | null;
  private readonly model: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly config: ConfigService<Env, true>,
  ) {
    const apiKey = this.config.get('GROQ_API_KEY', { infer: true });
    this.client = apiKey ? new Groq({ apiKey }) : null;
    this.model = this.config.get('GROQ_MODEL', { infer: true });
  }

  async generate(userId: string, prompt: string): Promise<GenerateResponseDto> {
    if (!this.client) {
      return this.demoResponse(userId, prompt);
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0.4,
        max_tokens: 800,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      });

      const response = completion.choices[0]?.message?.content?.trim() ?? '';
      const tokensUsed = completion.usage?.total_tokens ?? null;

      await this.db.insert(generations).values({
        userId,
        prompt,
        response,
        model: this.model,
        tokensUsed,
      });

      return { response, model: this.model, tokensUsed };
    } catch (err) {
      this.logger.error(
        'Groq request failed',
        err instanceof Error ? err.stack : String(err),
      );
      throw new ServiceUnavailableException({ error: 'ai_unavailable' });
    }
  }

  async list(userId: string): Promise<GenerationSummaryDto[]> {
    const rows = await this.db
      .select({
        id: generations.id,
        prompt: generations.prompt,
        response: generations.response,
        model: generations.model,
        tokensUsed: generations.tokensUsed,
        createdAt: generations.createdAt,
      })
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(HISTORY_LIMIT);

    return rows.map((r) => ({
      id: r.id,
      prompt: r.prompt,
      response: r.response,
      model: r.model,
      tokensUsed: r.tokensUsed,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  private async demoResponse(
    userId: string,
    prompt: string,
  ): Promise<GenerateResponseDto> {
    const response =
      '[DEMO MODE] Configure GROQ_API_KEY in .env to enable real generation.';
    await this.db.insert(generations).values({
      userId,
      prompt,
      response,
      model: 'demo',
      tokensUsed: 0,
    });
    return { response, model: 'demo', tokensUsed: 0 };
  }
}
