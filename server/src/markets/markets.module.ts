import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketFactoryService } from './market-factory.service';
import { ResolutionService } from './resolution.service';
import { Market } from './market.entity';
import { CircleModule } from '../circle/circle.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Market]),
    CircleModule,
    BlockchainModule,
  ],
  providers: [MarketFactoryService, ResolutionService],
  exports: [MarketFactoryService, ResolutionService],
})
export class MarketsModule {}
