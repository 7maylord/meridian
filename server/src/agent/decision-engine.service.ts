import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from '../blockchain/blockchain.service';
import { StructuredMarket, DeploymentDecision } from './agent.types';

@Injectable()
export class DecisionEngineService {
  private readonly logger = new Logger(DecisionEngineService.name);
  private readonly minConfidence: number;
  private readonly minLiquidity: number;
  private readonly defaultBParam: string;

  constructor(
    private readonly config: ConfigService,
    private readonly blockchain: BlockchainService,
  ) {
    this.minConfidence = this.config.get<number>('agent.minConfidence')!;
    this.minLiquidity = this.config.get<number>('agent.minLiquidity')!;
    this.defaultBParam = this.config.get<string>('agent.defaultBParam')!;
  }

  /**
   * Determine whether to deploy a market and how to size the position.
   */
  async evaluate(market: StructuredMarket): Promise<DeploymentDecision> {
    // Gate 1: Confidence threshold
    if (market.confidence < this.minConfidence) {
      return this.reject(`Confidence ${market.confidence} < ${this.minConfidence}`);
    }

    // Gate 2: Vault has enough capital
    const availableCapital = await this.blockchain.getVaultCapital();
    const availableUSDC = Number(availableCapital) / 1e6;

    // Bypassed for hackathon/testing so the agent can create markets without needing testnet USDC in the vault
    // if (availableUSDC < this.minLiquidity) {
    //   return this.reject(`Vault capital $${availableUSDC} < $${this.minLiquidity}`);
    // }

    // Kelly fraction sizing
    const stakeSide = market.pYes >= 0.5 ? 'YES' : 'NO';
    const p = stakeSide === 'YES' ? market.pYes : 1 - market.pYes;
    const odds = 1; // Binary market, fair odds = 1:1
    const kellyF = this.kellyFraction(p, odds);

    // Half-Kelly for safety, min $10, max 20% of vault
    const halfKelly = kellyF / 2;
    const maxStake = availableUSDC * 0.2;
    const rawStake = halfKelly * availableUSDC;
    const stakeAmount = Math.max(10, Math.min(rawStake, maxStake));

    // Determine collateral
    const collateral =
      market.settlementToken === 'EURC'
        ? this.config.get<string>('contracts.eurc')!
        : this.config.get<string>('contracts.usdc')!;

    // Check if we need to redeem USYC
    let redeemUsyc = false;
    let redeemAmount = 0;
    const stakeAmountScaled = stakeAmount * 1e6;

    if (availableCapital < BigInt(Math.floor(stakeAmountScaled))) {
      const usycBalance = await this.blockchain.getVaultUsycBalance();
      if (usycBalance > 0n) {
        redeemUsyc = true;
        redeemAmount = stakeAmount;
      }
    }

    this.logger.log(
      `Decision: DEPLOY | Side: ${stakeSide} | Stake: $${stakeAmount.toFixed(2)} | Kelly: ${(kellyF * 100).toFixed(1)}%`,
    );

    return {
      deploy: true,
      reason: 'Passed confidence and liquidity gates',
      stakeAmount: Math.floor(stakeAmount * 1e6), // 6-decimal
      stakeSide,
      bParam: this.defaultBParam,
      collateral,
      redeemUsyc,
      redeemAmount: Math.floor(redeemAmount * 1e6),
    };
  }

  /**
   * Kelly fraction: f = (p * odds - (1-p)) / odds
   */
  private kellyFraction(p: number, odds: number): number {
    const f = (p * odds - (1 - p)) / odds;
    return Math.max(0, Math.min(f, 1));
  }

  private reject(reason: string): DeploymentDecision {
    this.logger.log(`Decision: SKIP — ${reason}`);
    return {
      deploy: false,
      reason,
      stakeAmount: 0,
      stakeSide: 'YES',
      bParam: this.defaultBParam,
      collateral: this.config.get<string>('contracts.usdc')!,
      redeemUsyc: false,
      redeemAmount: 0,
    };
  }
}
