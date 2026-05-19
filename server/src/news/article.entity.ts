import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  url: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column()
  sourceLanguage: string;

  @Column()
  sourceName: string;

  @Column({ default: false })
  processed: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  publishedAt: Date | null;
}
