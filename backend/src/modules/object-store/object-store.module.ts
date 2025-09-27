import { Module } from '@nestjs/common';
import { ObjectStoreService } from './object-store.service';
import { ObjectStoreController } from './object-store.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ObjectStoreService],
  controllers: [ObjectStoreController],
  exports: [ObjectStoreService],
})
export class ObjectStoreModule {}
