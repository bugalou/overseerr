import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './User';
import { News } from './News';

@Entity()
export class NewsComment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  comment: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { eager: true })
  author: User;

  @ManyToOne(() => News, { onDelete: 'CASCADE' })
  news: News;
}