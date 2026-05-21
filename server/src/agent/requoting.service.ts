import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market, MarketStatus } from '../markets/market.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { ConfigService } from '@nestjs/config';

const DRIFT_THRESHOLD = 0.05; // 5% price drift triggers a re-quote
const MAX_ADD_FRACTION = 0.1; // add at most 10% of vault on a single requote

@Injectable()
export class RequotingService {
  private readonly logger = new Logger(RequotingService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Market)
    private readonly marketRepo: Repository<Market>,
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runRequote(): Promise<void> {
    if (this.isRunning || !this.wallets.isReady()) return;
    this.isRunning = true;

    try {
      const active = await this.marketRepo.find({
        where: { status: MarketStatus.ACTIVE },
      });

      for (const market of active) {
        if (market.marketId == null) continue;
        await this.maybeRequote(market);
      }
    } catch (err) {
      this.logger.error(`Requoting loop error: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
    }
  }

  private async maybeRequote(market: Market): Promise<void> {
    try {
      const registry = this.blockchain.getMarketRegistryContract();
      const priceResult = (await registry.getPrice(market.marketId)) as [
        bigint,
        bigint,
      ];
      const [yesPrice] = priceResult;
      const onChainP = Number(yesPrice) / 10_000;

      const agentP = Number(market.pYes);
      const drift = Math.abs(onChainP - agentP);

      if (drift <= DRIFT_THRESHOLD) return;

      // Market drifted away from agent's belief — add to position at better price
      const agentSideIsYes = market.stakeSide === 'YES';
      const marketMovedAgainstAgent =
        (agentSideIsYes && onChainP < agentP) ||
        (!agentSideIsYes && onChainP > agentP);

      if (!marketMovedAgainstAgent) return;

      const availableCapital = await this.blockchain.getVaultCapital();
      const availableUSDC = Number(availableCapital) / 1e6;
      const addAmount = Math.min(availableUSDC * MAX_ADD_FRACTION, availableUSDC);

      if (addAmount < 10) {
        this.logger.log(
          `Requote skipped — vault capital too low ($${availableUSDC.toFixed(2)})`,
        );
        return;
      }

      const priceBps = agentSideIsYes ? Number(yesPrice) : 10_000 - Number(yesPrice);
      const safePriceBps = priceBps > 0 ? priceBps : 5_000;
      const addAmountBI = BigInt(Math.floor(addAmount * 1e6));
      const shares = (addAmountBI * 10_000_000_000_000_000n) / BigInt(safePriceBps);

      const vaultAddr = this.config.get<string>('contracts.agentVault')!;
      const calldata = this.blockchain.encodeVaultDeployCapital(
        market.marketId,
        agentSideIsYes,
        shares,
      );

      this.logger.log(
        `Requoting market ${market.marketId}: drift=${(drift * 100).toFixed(1)}%, adding $${addAmount.toFixed(2)} ${market.stakeSide}`,
      );

      const txId = await this.wallets.sendContractCall(vaultAddr, calldata);
      await this.wallets.waitForTransaction(txId);
      this.logger.log(`Requote confirmed for market ${market.marketId}`);
    } catch (err) {
      this.logger.warn(
        `Requote failed for market ${market.marketId}: ${(err as Error).message}`,
      );
    }
  }
}
