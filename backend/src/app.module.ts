import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TerminusModule } from '@nestjs/terminus';

// Core modules
import { DatabaseModule } from './modules/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { TriageModule } from './modules/triage/triage.module';
import { CustomerModule } from './modules/customer/customer.module';
import { ActionsModule } from './modules/actions/actions.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { HealthModule } from './modules/health/health.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InsightsModule } from './modules/insights/insights.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { EvalsModule } from './modules/evals/evals.module';
import { TracesModule } from './modules/traces/traces.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RedisModule } from './modules/redis/redis.module';
import { ObjectStoreModule } from './modules/object-store/object-store.module';

// Configuration
import { databaseConfig } from './config/database.config';
import { redisConfig } from './config/redis.config';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig],
    }),

    // Database
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USER || 'aegis_user',
      password: process.env.DB_PASSWORD || 'aegis_password',
      database: process.env.DB_NAME || 'aegis_support',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false, // Temporarily disabled to avoid schema conflicts
      logging: process.env.NODE_ENV === 'development',
    }),



    // Health checks
    TerminusModule,

            // Application modules
            DatabaseModule,
            AuthModule,
            RedisModule,
            TriageModule,
            CustomerModule,
            ActionsModule,
            MetricsModule,
            HealthModule,
            IngestionModule,
            InsightsModule,
            KnowledgeBaseModule,
            EvalsModule,
            TracesModule,
            DashboardModule,
            ObjectStoreModule,
  ],
})
export class AppModule {}
