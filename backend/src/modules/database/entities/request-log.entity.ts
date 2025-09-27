import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('request_logs')
export class RequestLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  requestId: string;

  @Column()
  sessionId: string;

  @Column()
  customerId: string;

  @Column()
  method: string;

  @Column()
  url: string;

  @Column()
  statusCode: number;

  @Column()
  duration: number;

  @Column({ nullable: true })
  errorType: string;

  @CreateDateColumn()
  createdAt: Date;
}
