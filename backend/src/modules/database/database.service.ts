import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { secureLogger } from '../../utils/logger';

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

@Injectable()
export class DatabaseService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Card)
    private readonly cardRepository: Repository<Card>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    @InjectRepository(Chargeback)
    private readonly chargebackRepository: Repository<Chargeback>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(KnowledgeBaseDocument)
    private readonly kbDocumentRepository: Repository<KnowledgeBaseDocument>,
    @InjectRepository(AgentTrace)
    private readonly agentTraceRepository: Repository<AgentTrace>,
    @InjectRepository(RequestLog)
    private readonly requestLogRepository: Repository<RequestLog>,
  ) {}

  // Customer operations
  async findCustomerById(id: string): Promise<Customer | null> {
    return this.customerRepository.findOne({ where: { id } });
  }

  async findCustomers(): Promise<Customer[]> {
    return this.customerRepository.find();
  }

  // Transaction operations
  async findTransactionById(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({ where: { id } });
  }

  async createTransaction(transactionData: any): Promise<Transaction> {
    const transaction = this.transactionRepository.create(transactionData);
    const result = await this.transactionRepository.save(transaction);
    return Array.isArray(result) ? result[0] : result;
  }

  async findTransactionsByCustomer(customerId: string, limit = 100, offset = 0): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { customerId },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findTransactionsByCustomerLast90Days(customerId: string, limit = 100, offset = 0): Promise<Transaction[]> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    return this.transactionRepository.find({
      where: { 
        customerId,
        timestamp: MoreThanOrEqual(ninetyDaysAgo)
      },
      order: { timestamp: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async findTransactionsByCustomerAndDateRange(
    customerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Transaction[]> {
    return this.transactionRepository
      .createQueryBuilder('transaction')
      .where('transaction.customerId = :customerId', { customerId })
      .andWhere('transaction.timestamp BETWEEN :startDate AND :endDate', { startDate, endDate })
      .orderBy('transaction.timestamp', 'DESC')
      .getMany();
  }

  // Card operations
  async findCardById(id: string): Promise<Card | null> {
    return this.cardRepository.findOne({ where: { id } });
  }

  async findCardsByCustomer(customerId: string): Promise<Card[]> {
    return this.cardRepository.find({ where: { customerId } });
  }

  async updateCardStatus(cardId: string, status: string): Promise<void> {
    await this.cardRepository.update(cardId, { status });
  }

  // Device operations
  async findDeviceById(id: string): Promise<Device | null> {
    return this.deviceRepository.findOne({ where: { id } });
  }

  async findDevicesByCustomer(customerId: string): Promise<Device[]> {
    return this.deviceRepository.find({ where: { customerId } });
  }

  // Chargeback operations
  async findChargebacksByCustomer(customerId: string): Promise<Chargeback[]> {
    return this.chargebackRepository.find({ where: { customerId: customerId } });
  }

  async createChargeback(chargebackData: Partial<Chargeback>): Promise<Chargeback> {
    const chargeback = this.chargebackRepository.create(chargebackData);
    return this.chargebackRepository.save(chargeback);
  }

  // Action operations
  async createAction(actionData: Partial<Action>): Promise<Action> {
    const action = this.actionRepository.create(actionData);
    return this.actionRepository.save(action);
  }

  async findActionsByCustomer(customerId: string): Promise<Action[]> {
    return this.actionRepository.find({ 
      where: { customerId },
      order: { createdAt: 'DESC' }
    });
  }

  // Knowledge Base operations
  async searchKnowledgeBase(query: string): Promise<KnowledgeBaseDocument[]> {
    return this.kbDocumentRepository
      .createQueryBuilder('kb')
      .where('kb.title ILIKE :query OR kb.content ILIKE :query', { query: `%${query}%` })
      .getMany();
  }

  async findKnowledgeBaseDocumentById(id: string): Promise<KnowledgeBaseDocument | null> {
    return this.kbDocumentRepository.findOne({ where: { id } });
  }

  // Agent Trace operations
  async saveAgentTrace(traceData: Partial<AgentTrace>): Promise<AgentTrace> {
    const trace = this.agentTraceRepository.create(traceData);
    return this.agentTraceRepository.save(trace);
  }

  async findAgentTraceById(id: string): Promise<AgentTrace | null> {
    return this.agentTraceRepository.findOne({ where: { id } });
  }

  // Request Log operations
  async logRequest(logData: Partial<RequestLog>): Promise<RequestLog> {
    const log = this.requestLogRepository.create(logData);
    return this.requestLogRepository.save(log);
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.customerRepository.query('SELECT 1');
      return true;
    } catch (error) {
      secureLogger.error('Database health check failed', { error: error.message });
      return false;
    }
  }

  // Fixture loading
  async loadFixtureData(type: string): Promise<any[]> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const fixturePath = path.join(__dirname, '../../../fixtures', `${type}.json`);
      
      if (!fs.existsSync(fixturePath)) {
        secureLogger.warn('Fixture file not found', { type, path: fixturePath });
        return [];
      }
      
      const data = fs.readFileSync(fixturePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      secureLogger.error('Failed to load fixture data', { type, error: error.message });
      return [];
    }
  }

  async getTransactionCountByCustomer(customerId: string): Promise<number> {
    try {
      const count = await this.transactionRepository.count({
        where: { customerId }
      });
      return count;
    } catch (error) {
      secureLogger.error('Failed to get transaction count', { customerId, error: error.message });
      return 0;
    }
  }
}
