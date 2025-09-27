import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('devices')
export class Device {
  @PrimaryColumn()
  id: string;

  @Column({ name: 'customer_id' })
  customerId: string;

  @Column({ name: 'device_type' })
  deviceType: string;

  @Column()
  os: string;

  @Column({ name: 'osversion' })
  osVersion: string;

  @Column({ name: 'appversion' })
  appVersion: string;

  @Column({ name: 'devicefingerprint' })
  deviceFingerprint: string;

  @Column({ name: 'firstseen', type: 'timestamp' })
  firstSeen: Date;

  @Column({ name: 'lastseen', type: 'timestamp' })
  lastSeen: Date;

  @Column({ name: 'isactive', default: true })
  isActive: boolean;

  @Column({ name: 'trustscore', type: 'decimal', precision: 3, scale: 2, default: 0.5 })
  trustScore: number;

  @Column({ name: 'location', type: 'jsonb', nullable: true })
  location: any;

  @Column({ name: 'riskflags', type: 'jsonb', nullable: true })
  riskFlags: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer, customer => customer.devices)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
