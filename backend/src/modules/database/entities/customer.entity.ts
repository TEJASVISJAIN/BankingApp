import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Card } from './card.entity';
import { Transaction } from './transaction.entity';
import { Device } from './device.entity';
import { Chargeback } from './chargeback.entity';
import { Action } from './action.entity';

@Entity('customers')
export class Customer {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ name: 'email_masked' })
  email: string;


  @Column({ name: 'risk_flags', type: 'jsonb', nullable: true })
  riskFlags: any;


  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Card, card => card.customer)
  cards: Card[];

  @OneToMany(() => Transaction, transaction => transaction.customer)
  transactions: Transaction[];

  @OneToMany(() => Device, device => device.customer)
  devices: Device[];

  @OneToMany(() => Chargeback, chargeback => chargeback.customer)
  chargebacks: Chargeback[];

  @OneToMany(() => Action, action => action.customer)
  actions: Action[];
}
