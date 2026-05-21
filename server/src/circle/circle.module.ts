import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { Erc8004Service } from './erc8004.service';

@Module({
  providers: [WalletsService, Erc8004Service],
  exports: [WalletsService, Erc8004Service],
})
export class CircleModule {}
