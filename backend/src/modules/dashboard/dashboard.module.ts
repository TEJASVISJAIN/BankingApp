import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardGateway } from './dashboard.gateway';
import { AuthModule } from '../auth/auth.module';
import { Transaction } from '../database/entities/transaction.entity';
import { Customer } from '../database/entities/customer.entity';
import { Card } from '../database/entities/card.entity';
import { Chargeback } from '../database/entities/chargeback.entity';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([Transaction, Customer, Card, Chargeback]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
  exports: [DashboardService, DashboardGateway],
})
export class DashboardModule {}
