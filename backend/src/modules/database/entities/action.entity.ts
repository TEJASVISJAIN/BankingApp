import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('actions')
export class Action {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'action_type' })
  actionType: string;

  @Column({ name: 'action_data', type: 'jsonb' })
  actionData: any;

  @Column()
  status: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer, customer => customer.actions)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
