import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletsService } from '../circle/wallets.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { StructuredMarket, DeploymentDecision } from '../agent/agent.types';

@Injectable()
export class MarketFactoryService {
  private readonly logger = new Logger(MarketFactoryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly wallets: WalletsService,
    private readonly blockchain: BlockchainService,
  ) {}

  /**
   * Deploy a new prediction market on-chain and stake on it.
   */
  async deployMarket(
    market: StructuredMarket,
    decision: DeploymentDecision,
  ): Promise<{ marketId: bigint; txHash: string }> {
    if (!this.wallets.isReady()) {
      throw new Error('Circle wallet not ready');
    }

    const factoryAddr = this.config.get<string>('contracts.marketFactory')!;
    const vaultAddr = this.config.get<string>('contracts.agentVault')!;

    // Calculate expiry from resolution deadline
    const expiry = BigInt(
      Math.floor(new Date(market.resolutionDeadline).getTime() / 1000),
    );

    // Step 1: Create the market
    const createCalldata = this.blockchain.encodeMarketFactoryCreate(
      market.question,
      market.resolutionCriteria,
      expiry,
      BigInt(decision.bParam),
      decision.collateral,
    );

    this.logger.log(`Creating market: "${market.question}"`);
    const createTxId = await this.wallets.sendContractCall(
      factoryAddr,
      createCalldata,
    );

    this.logger.log(`Market creation transaction submitted: ${createTxId}`);
    const txHash = await this.wallets.waitForTransaction(createTxId);
    this.logger.log(`Market creation transaction confirmed: ${txHash}`);

    const count = await this.blockchain.getMarketCount();
    const marketId = count - 1n;
    this.logger.log(`Created market ID: ${marketId.toString()}`);

    // Step 2: Deploy capital from vault if deploy decision is true
    if (decision.deploy && decision.stakeAmount > 0) {
      try {
        const isYes = decision.stakeSide === 'YES';

        // Get current price of outcome to calculate shares
        const registryContract = this.blockchain.getMarketRegistryContract();
        const [yesPrice, noPrice] = await registryContract.getPrice(marketId);
        const priceBps = isYes ? Number(yesPrice) : Number(noPrice);
        const safePriceBps = priceBps > 0 ? priceBps : 5000;

        // shares = (stakeAmount * 1e16) / priceBps
        const stakeAmountBI = BigInt(decision.stakeAmount);
        const shares =
          (stakeAmountBI * 10000000000000000n) / BigInt(safePriceBps);

        const deployCalldata = this.blockchain.encodeVaultDeployCapital(
          marketId,
          isYes,
          shares,
        );

        this.logger.log(
          `Deploying capital to market ID ${marketId}: side=${decision.stakeSide}, stakeAmount=${decision.stakeAmount}, shares=${shares.toString()}`,
        );

        const deployTxId = await this.wallets.sendContractCall(
          vaultAddr,
          deployCalldata,
        );

        this.logger.log(`Vault deployment transaction submitted: ${deployTxId}`);
        const deployTxHash = await this.wallets.waitForTransaction(deployTxId);
        this.logger.log(
          `Vault deployment transaction confirmed: ${deployTxHash}`,
        );
      } catch (err) {
        this.logger.warn(
          `Capital deployment failed (market still created): ${err.message}`,
        );
      }
    }

    return { marketId, txHash };
  }
}
