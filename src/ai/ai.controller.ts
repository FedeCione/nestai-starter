import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { errorResponseOpenApi } from '../auth/dto/auth.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AiService } from './ai.service';
import {
  generateRequestOpenApi,
  generateRequestSchema,
  generateResponseOpenApi,
  generationSummaryListOpenApi,
  type GenerateRequestDto,
  type GenerateResponseDto,
  type GenerationSummaryDto,
} from './dto/ai.dto';

@ApiTags('ai')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(generateRequestSchema))
  @ApiOperation({ summary: 'Generate a response from the configured LLM' })
  @ApiBody({ schema: generateRequestOpenApi })
  @ApiOkResponse({ schema: generateResponseOpenApi })
  @ApiUnauthorizedResponse({
    description: 'unauthorized',
    schema: errorResponseOpenApi,
  })
  @ApiServiceUnavailableResponse({
    description: 'ai_unavailable',
    schema: errorResponseOpenApi,
  })
  generate(
    @Req() req: Request,
    @Body() dto: GenerateRequestDto,
  ): Promise<GenerateResponseDto> {
    return this.ai.generate(req.user!.id, dto.prompt);
  }

  @Get('generations')
  @ApiOperation({
    summary: 'List the last 20 generations for the authenticated user',
  })
  @ApiOkResponse({ schema: generationSummaryListOpenApi })
  @ApiUnauthorizedResponse({
    description: 'unauthorized',
    schema: errorResponseOpenApi,
  })
  list(@Req() req: Request): Promise<GenerationSummaryDto[]> {
    return this.ai.list(req.user!.id);
  }
}
