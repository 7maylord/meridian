import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import {
  MERIDIAN_MARKET_ABI,
  AGENT_VAULT_ABI,
  RESOLUTION_ORACLE_ABI,
  ERC20_ABI,
} from '../config/contracts';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private marketContract: ethers.Contract;
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

    this.marketContract = new ethers.Contract(
      factoryAddr,
      MERIDIAN_MARKET_ABI,
      this.provider,
    );
    this.vaultContract = new ethers.Contract(
      vaultAddr,
      AGENT_VAULT_ABI,
      this.provider,
    );
  }

  /**
   * Get the MeridianMarket registry contract instance.
   */
  getMarketRegistryContract(): ethers.Contract {
    return this.marketContract;
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
   * Get total market count from the registry.
   */
  async getMarketCount(): Promise<bigint> {
    return this.marketContract.marketCount();
  }

  /**
   * Read market state.
   */
  async getMarketState(marketId: number | bigint) {
    const [
      question,
      resolutionCriteria,
      collateralToken,
      qYes,
      qNo,
      expiry,
      isResolved,
      outcome,
      creator,
      totalCollateral,
    ] = await this.marketContract.getMarket(marketId);

    return {
      question,
      resolutionCriteria,
      collateralToken,
      qYes,
      qNo,
      expiry,
      isResolved,
      outcome,
      creator,
      totalCollateral,
    };
  }

  /**
   * Get the cost to buy shares (returns 6-decimal collateral cost).
   */
  async getShareCost(
    marketId: number | bigint,
    isYes: boolean,
    shares: bigint,
  ): Promise<bigint> {
    return this.marketContract.getCost(marketId, isYes, shares);
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
    const iface = new ethers.Interface(MERIDIAN_MARKET_ABI);
    return iface.encodeFunctionData('createMarket', [
      question,
      criteria,
      expiry,
      bParam,
      collateral,
    ]);
  }

  encodeVaultDeployCapital(
    marketId: number | bigint,
    isYes: boolean,
    shares: bigint,
  ): string {
    const iface = new ethers.Interface(AGENT_VAULT_ABI);
    return iface.encodeFunctionData('deployCapital', [marketId, isYes, shares]);
  }

  encodeMarketBuy(
    marketId: number | bigint,
    isYes: boolean,
    shares: bigint,
  ): string {
    const iface = new ethers.Interface(MERIDIAN_MARKET_ABI);
    return iface.encodeFunctionData('buy', [marketId, isYes, shares]);
  }

  encodeConfigureOracle(marketId: number | bigint, expiry: bigint): string {
    const iface = new ethers.Interface(RESOLUTION_ORACLE_ABI);
    return iface.encodeFunctionData('configureOracle', [
      marketId,
      1, // OracleTier.Admin
      ethers.ZeroAddress,
      0, // ComparisonType.GreaterThan (ignored for Admin tier)
      0, // threshold (ignored for Admin tier)
      expiry,
    ]);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}
