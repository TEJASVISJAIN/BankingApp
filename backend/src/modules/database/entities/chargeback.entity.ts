import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('chargebacks')
export class Chargeback {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'transaction_id' })
  transactionId: string;

  @Column({ type: 'bigint' })
  amount: number;

  @Column()
  currency: string;

  @Column({ name: 'reason_code' })
  reason: string;

  @Column()
  status: string;

  @Column()
  merchant: string;

  @Column()
  mcc: string;

  @Column({ name: 'disputedate', type: 'timestamp' })
  disputeDate: Date;

  @Column({ name: 'resolutiondate', type: 'timestamp', nullable: true })
  resolutionDate: Date;

  @Column({ nullable: true })
  resolution: string;

  @Column({ type: 'jsonb', nullable: true })
  evidence: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Customer, customer => customer.chargebacks)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
