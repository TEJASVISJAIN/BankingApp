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

  @Column({ name: 'device_info', type: 'jsonb', nullable: true })
  deviceInfo: any;

  @Column({ name: 'last_seen', type: 'timestamp' })
  lastSeen: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Customer, customer => customer.devices)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}
