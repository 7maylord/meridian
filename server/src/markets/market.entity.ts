import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum MarketStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

@Entity('markets')
export class Market {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  contractAddress: string;

  @Column()
  question: string;

  @Column({ type: 'text' })
  resolutionCriteria: string;

  @Column({ type: 'timestamp' })
  resolutionDeadline: Date;

  @Column({ type: 'int', default: 2 })
  oracleTier: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  pYes: number;

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  confidence: number;

  @Column()
  sourceLanguage: string;

  @Column()
  sourceName: string;

  @Column({ default: 'USDC' })
  settlementToken: string;

  @Column({ nullable: true })
  vertical: string;

  @Column({
    type: 'enum',
    enum: MarketStatus,
    default: MarketStatus.PENDING,
  })
  status: MarketStatus;

  @Column({ nullable: true })
  outcome: boolean;

  // Agent position
  @Column({ type: 'decimal', precision: 20, scale: 6, nullable: true })
  stakeAmount: number;

  @Column({ nullable: true })
  stakeSide: string; // 'YES' | 'NO'

  @Column({ nullable: true })
  articleId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
