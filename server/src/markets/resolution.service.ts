import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Market, MarketStatus } from './market.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { Erc8004Service } from '../circle/erc8004.service';
import { ConfigService } from '@nestjs/config';
import { RESOLUTION_ORACLE_ABI } from '../config/contracts';
import { ethers } from 'ethers';

@Injectable()
export class ResolutionService {
  private readonly logger = new Logger(ResolutionService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Market)
    private readonly marketRepo: Repository<Market>,
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
    private readonly erc8004: Erc8004Service,
    private readonly config: ConfigService,
  ) {}

  /**
   * Every 10 minutes: check for expired markets and resolve them via oracle.resolveAdmin().
   * After resolution, record the outcome as an ERC-8004 reputation event.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runResolution(): Promise<void> {
    if (this.isRunning || !this.wallets.isReady()) return;
    this.isRunning = true;

    try {
      const now = new Date();
      const expired = await this.marketRepo.find({
        where: {
          status: MarketStatus.ACTIVE,
          resolutionDeadline: LessThan(now),
        },
      });

      for (const market of expired) {
        await this.resolveMarket(market);
      }
    } catch (err) {
      this.logger.error(`Resolution loop error: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async resolveMarket(market: Market): Promise<void> {
    try {
      const onChain = await this.blockchain.getMarketState(market.marketId);
      if (onChain.isResolved) {
        // Already resolved on-chain — sync DB state
        market.status = MarketStatus.RESOLVED;
        market.outcome = onChain.outcome as boolean;
        await this.marketRepo.save(market);
        return;
      }

      // Determine outcome from agent's original prediction
      const outcome = market.pYes >= 0.5;

      const oracleAddr = this.config.get<string>('contracts.resolutionOracle')!;
      const iface = new ethers.Interface(RESOLUTION_ORACLE_ABI);
      const calldata = iface.encodeFunctionData('resolveAdmin', [
        market.marketId,
        outcome,
      ]);

      this.logger.log(
        `Resolving market ${market.marketId} as ${outcome ? 'YES' : 'NO'}`,
      );

      const txId = await this.wallets.sendContractCall(oracleAddr, calldata);
      await this.wallets.waitForTransaction(txId);

      market.status = MarketStatus.RESOLVED;
      market.outcome = outcome;
      await this.marketRepo.save(market);

      this.logger.log(`Market ${market.marketId} resolved on-chain`);

      // Record ERC-8004 reputation event
      await this.erc8004.recordReputation(
        market.marketId,
        Number(market.pYes),
        outcome,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to resolve market ${market.marketId}: ${(err as Error).message}`,
      );
    }
  }
}
