import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { Article } from './news/article.entity';
import { Market } from './markets/market.entity';
import { NewsModule } from './news/news.module';
import { CircleModule } from './circle/circle.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AgentModule } from './agent/agent.module';
import { MarketsModule } from './markets/markets.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Cron scheduler
    ScheduleModule.forRoot(),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get<string>('database.url'),
        entities: [Article, Market],
        synchronize: true, // Auto-create tables (dev only)
        ssl: { rejectUnauthorized: false },
      }),
    }),

    // Feature modules
    NewsModule,
    CircleModule,
    BlockchainModule,
    MarketsModule,
    AgentModule,
    ApiModule,
  ],
})
export class AppModule {}
