import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RateLimitGuard } from './rate-limit.guard';
import { TokenBucketService } from './token-bucket.service';
import { MetricsModule } from '../metrics/metrics.module';

@Module({
  imports: [MetricsModule],
  providers: [RedisService, RateLimitGuard, TokenBucketService],
  exports: [RedisService, RateLimitGuard, TokenBucketService],
})
export class RedisModule {}
