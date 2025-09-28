import { Module, forwardRef } from '@nestjs/common';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [
    DatabaseModule, 
    AuthModule, 
    CommonModule,
    forwardRef(() => DashboardModule),
  ],
  controllers: [IngestionController],
  providers: [IngestionService],
})
export class IngestionModule {}
