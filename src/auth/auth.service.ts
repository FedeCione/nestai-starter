import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDatabase } from '../database/database.module';
import { users } from '../database/schema';
import type { CredentialsDto, TokenResponse } from './dto/auth.dto';
import type { AuthenticatedUser, JwtPayload } from './types';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: CredentialsDto): Promise<TokenResponse> {
    const existing = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException({ error: 'email_taken' });
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const [created] = await this.db
      .insert(users)
      .values({ email: dto.email, passwordHash })
      .returning({ id: users.id, email: users.email });

    return this.issueToken({ id: created.id, email: created.email });
  }

  async login(dto: CredentialsDto): Promise<TokenResponse> {
    const [user] = await this.db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user)
      throw new UnauthorizedException({ error: 'invalid_credentials' });

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException({ error: 'invalid_credentials' });

    return this.issueToken({ id: user.id, email: user.email });
  }

  private async issueToken(user: AuthenticatedUser): Promise<TokenResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken };
  }
}
