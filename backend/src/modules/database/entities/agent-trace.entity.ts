import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('agent_traces')
export class AgentTrace {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'transaction_id', nullable: true })
  transactionId: string;

  @Column({ name: 'trace_data', type: 'jsonb' })
  traceData: any;

  @Column({ name: 'status', type: 'enum', enum: ['idle', 'running', 'completed', 'failed'] })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt: Date;
}
