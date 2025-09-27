import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseService } from './database.service';

// Entities
import { Customer } from './entities/customer.entity';
import { Card } from './entities/card.entity';
import { Transaction } from './entities/transaction.entity';
import { Device } from './entities/device.entity';
import { Chargeback } from './entities/chargeback.entity';
import { Action } from './entities/action.entity';
import { KnowledgeBaseDocument } from './entities/knowledge-base-document.entity';
import { AgentTrace } from './entities/agent-trace.entity';
import { RequestLog } from './entities/request-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      Card,
      Transaction,
      Device,
      Chargeback,
      Action,
      KnowledgeBaseDocument,
      AgentTrace,
      RequestLog,
    ]),
  ],
  providers: [DatabaseService],
  exports: [DatabaseService, TypeOrmModule],
})
export class DatabaseModule {}
