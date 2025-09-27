import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyGuard } from './guards/api-key.guard';

@Module({
  providers: [AuthService, ApiKeyGuard],
  controllers: [AuthController],
  exports: [AuthService, ApiKeyGuard],
})
export class AuthModule {}
