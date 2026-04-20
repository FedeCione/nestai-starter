import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
