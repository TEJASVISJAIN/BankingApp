import { Module } from '@nestjs/common';
import { TracesController } from './traces.controller';
import { TracesService } from './traces.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [TracesController],
  providers: [TracesService],
})
export class TracesModule {}
