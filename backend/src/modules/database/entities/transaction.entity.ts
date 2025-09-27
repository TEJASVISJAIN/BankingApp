import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('transactions')
@Index(['customerId', 'timestamp']) // Composite index for customer queries with date filtering
@Index(['timestamp']) // Index for timestamp-based queries
@Index(['customerId']) // Index for customer-based queries
@Index(['merchant']) // Index for merchant-based queries
@Index(['mcc']) // Index for MCC-based queries
export class Transaction {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'card_id' })
  cardId: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column()
  currency: string;

  @Column()
  merchant: string;

  @Column()
  mcc: string;

  @Column({ name: 'ts', type: 'timestamp' })
  timestamp: Date;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ name: 'deviceinfo', type: 'jsonb', nullable: true })
  deviceInfo: any;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer, customer => customer.transactions)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
