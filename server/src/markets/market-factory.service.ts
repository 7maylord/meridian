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
  ): Promise<string> {
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

    // Step 2: Deploy capital from vault
    // Note: In production, we'd wait for the create tx to confirm
    // and read the new market address from the event logs.
    // For the hackathon, we log the tx ID for manual verification.
    this.logger.log(`Market creation tx: ${createTxId}`);

    return createTxId;
  }
}
