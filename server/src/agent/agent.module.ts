import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranslationService } from './translation.service';
import { DecisionEngineService } from './decision-engine.service';
import { AgentLoopService } from './agent-loop.service';
import { NewsModule } from '../news/news.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketsModule } from '../markets/markets.module';
import { Market } from '../markets/market.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Market]),
    NewsModule,
    BlockchainModule,
    MarketsModule,
  ],
  providers: [TranslationService, DecisionEngineService, AgentLoopService],
  exports: [TranslationService, DecisionEngineService, AgentLoopService],
})
export class AgentModule {}
