import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('agent_traces')
export class AgentTrace {
  @PrimaryColumn()
  id: string;

  @Column()
  sessionId: string;

  @Column({ nullable: true })
  transactionId: string;

  @Column({ type: 'jsonb' })
  traceData: any;

  @CreateDateColumn()
  createdAt: Date;
}
