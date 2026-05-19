import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsIngestionService } from './news-ingestion.service';
import { Article } from './article.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Article])],
  providers: [NewsIngestionService],
  exports: [NewsIngestionService],
})
export class NewsModule {}
