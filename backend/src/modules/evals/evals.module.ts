import { Module } from '@nestjs/common';
import { EvalsController } from './evals.controller';
import { EvalsService } from './evals.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { TriageModule } from '../triage/triage.module';

@Module({
  imports: [DatabaseModule, AuthModule, TriageModule],
  controllers: [EvalsController],
  providers: [EvalsService],
})
export class EvalsModule {}
