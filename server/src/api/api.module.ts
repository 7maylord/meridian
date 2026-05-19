import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiController } from './api.controller';
import { Market } from '../markets/market.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { CircleModule } from '../circle/circle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Market]),
    BlockchainModule,
    CircleModule,
  ],
  controllers: [ApiController],
})
export class ApiModule {}
