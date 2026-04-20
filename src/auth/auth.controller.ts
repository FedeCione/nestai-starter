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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import {
  credentialsOpenApi,
  credentialsSchema,
  errorResponseOpenApi,
  tokenResponseOpenApi,
  userResponseOpenApi,
  type CredentialsDto,
  type TokenResponse,
  type UserResponse,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(credentialsSchema))
  @ApiOperation({ summary: 'Register a new user and issue an access token' })
  @ApiBody({ schema: credentialsOpenApi })
  @ApiCreatedResponse({ schema: tokenResponseOpenApi })
  @ApiConflictResponse({
    description: 'email_taken',
    schema: errorResponseOpenApi,
  })
  register(@Body() dto: CredentialsDto): Promise<TokenResponse> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(credentialsSchema))
  @ApiOperation({ summary: 'Exchange credentials for an access token' })
  @ApiBody({ schema: credentialsOpenApi })
  @ApiOkResponse({ schema: tokenResponseOpenApi })
  @ApiUnauthorizedResponse({
    description: 'invalid_credentials',
    schema: errorResponseOpenApi,
  })
  login(@Body() dto: CredentialsDto): Promise<TokenResponse> {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the authenticated user' })
  @ApiOkResponse({ schema: userResponseOpenApi })
  @ApiUnauthorizedResponse({
    description: 'unauthorized',
    schema: errorResponseOpenApi,
  })
  me(@Req() req: Request): UserResponse {
    return { id: req.user!.id, email: req.user!.email };
  }
}
