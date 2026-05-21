import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TranslationService } from './translation.service';
import { DecisionEngineService } from './decision-engine.service';
import { AgentLoopService } from './agent-loop.service';
import { RequotingService } from './requoting.service';
import { NewsModule } from '../news/news.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { MarketsModule } from '../markets/markets.module';
import { CircleModule } from '../circle/circle.module';
import { Market } from '../markets/market.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Market]),
    NewsModule,
    BlockchainModule,
    MarketsModule,
    CircleModule,
  ],
  providers: [
    TranslationService,
    DecisionEngineService,
    AgentLoopService,
    RequotingService,
  ],
  exports: [
    TranslationService,
    DecisionEngineService,
    AgentLoopService,
    RequotingService,
  ],
})
export class AgentModule {}
