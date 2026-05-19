import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  MARKET_FACTORY_ABI,
  PREDICTION_MARKET_ABI,
  AGENT_VAULT_ABI,
  ERC20_ABI,
} from '../config/contracts';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;
  private vaultContract: ethers.Contract;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const rpcUrl = this.config.get<string>('arc.rpcUrl');
    if (!rpcUrl) {
      this.logger.warn('ARC_RPC_URL not set — blockchain reads disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const factoryAddr = this.config.get<string>('contracts.marketFactory')!;
    const vaultAddr = this.config.get<string>('contracts.agentVault')!;

    this.factoryContract = new ethers.Contract(
      factoryAddr,
      MARKET_FACTORY_ABI,
      this.provider,
    );
    this.vaultContract = new ethers.Contract(
      vaultAddr,
      AGENT_VAULT_ABI,
      this.provider,
    );
  }

  /**
   * Get a PredictionMarket contract instance for reads.
   */
  getMarketContract(address: string): ethers.Contract {
    return new ethers.Contract(address, PREDICTION_MARKET_ABI, this.provider);
  }

  /**
   * Read vault available capital (6-decimal USDC).
   */
  async getVaultCapital(): Promise<bigint> {
    return this.vaultContract.getAvailableCapital();
  }

  /**
   * Read vault USYC balance (6-decimal).
   */
  async getVaultUsycBalance(): Promise<bigint> {
    return this.vaultContract.getUsycBalance();
  }

  /**
   * Read vault calibration score.
   */
  async getCalibrationScore(): Promise<{
    winRate: bigint;
    totalMarkets: bigint;
  }> {
    const [winRate, totalMarkets] =
      await this.vaultContract.getCalibrationScore();
    return { winRate, totalMarkets };
  }

  /**
   * Get all market addresses from the factory.
   */
  async getAllMarkets(): Promise<string[]> {
    return this.factoryContract.getMarkets();
  }

  /**
   * Read market state.
   */
  async getMarketState(address: string) {
    const market = this.getMarketContract(address);
    const [question, qYes, qNo, isResolved, outcome] = await Promise.all([
      market.question(),
      market.qYes(),
      market.qNo(),
      market.isResolved(),
      market.outcome(),
    ]);

    return { question, qYes, qNo, isResolved, outcome };
  }

  /**
   * Get the cost to buy shares (returns 6-decimal collateral cost).
   */
  async getShareCost(
    marketAddress: string,
    isYes: boolean,
    shares: bigint,
  ): Promise<bigint> {
    const market = this.getMarketContract(marketAddress);
    return market.getCost(isYes, shares);
  }

  /**
   * Encode calldata for contract interactions (used by Circle wallets).
   */
  encodeMarketFactoryCreate(
    question: string,
    criteria: string,
    expiry: bigint,
    bParam: bigint,
    collateral: string,
  ): string {
    const iface = new ethers.Interface(MARKET_FACTORY_ABI);
    return iface.encodeFunctionData('createMarket', [
      question,
      criteria,
      expiry,
      bParam,
      collateral,
    ]);
  }

  encodeVaultDeployCapital(
    market: string,
    amount: bigint,
    isYes: boolean,
  ): string {
    const iface = new ethers.Interface(AGENT_VAULT_ABI);
    return iface.encodeFunctionData('deployCapital', [market, amount, isYes]);
  }

  encodeMarketBuy(isYes: boolean, shares: bigint): string {
    const iface = new ethers.Interface(PREDICTION_MARKET_ABI);
    return iface.encodeFunctionData('buy', [isYes, shares]);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}
