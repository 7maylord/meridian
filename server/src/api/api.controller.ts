import { Controller, Get, Param, Post, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Market, MarketStatus } from '../markets/market.entity';
import { BlockchainService } from '../blockchain/blockchain.service';
import { WalletsService } from '../circle/wallets.service';
import { NanopaymentGuard } from './nanopayment.guard';

@Controller('api')
export class ApiController {
  constructor(
    @InjectRepository(Market)
    private readonly marketRepo: Repository<Market>,
    private readonly blockchain: BlockchainService,
    private readonly wallets: WalletsService,
  ) {}

  @Get()
  root() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      walletReady: this.wallets.isReady(),
      walletAddress: this.wallets.getAddress(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('markets')
  async getMarkets() {
    return this.marketRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  @Get('markets/:id')
  async getMarket(@Param('id') id: string) {
    return this.marketRepo.findOne({ where: { id } });
  }

  @Get('agent/stats')
  async getAgentStats() {
    const [capital, usycBalance, calibration] = await Promise.all([
      this.blockchain.getVaultCapital(),
      this.blockchain.getVaultUsycBalance(),
      this.blockchain.getCalibrationScore(),
    ]);

    const totalMarkets = await this.marketRepo.count();

    return {
      availableCapital: (Number(capital) / 1e6).toFixed(2),
      usycBalance: (Number(usycBalance) / 1e6).toFixed(2),
      winRate:
        Number(calibration.totalMarkets) > 0
          ? (Number(calibration.winRate) / 100).toFixed(1) + '%'
          : 'N/A',
      totalMarketsResolved: Number(calibration.totalMarkets),
      totalMarketsCreated: totalMarkets,
      walletAddress: this.wallets.getAddress(),
    };
  }

  @Post('markets/:id/resolve')
  async resolveMarket(
    @Param('id') id: string,
    @Body('outcome') outcome: boolean,
  ) {
    const market = await this.marketRepo.findOne({ where: { id } });
    if (!market) {
      throw new Error('Market not found');
    }

    market.status = MarketStatus.RESOLVED;
    market.outcome = outcome;

    await this.marketRepo.save(market);
    return market;
  }

  @Post('wallet/create')
  async createWallet() {
    return this.wallets.createWallet();
  }

  /**
   * Premium endpoint: returns the agent's current probability estimate for a market.
   * Requires a $0.01 USDC nanopayment — send tx hash in X-Payment-Tx header.
   */
  @Get('markets/:id/recommendation')
  @UseGuards(NanopaymentGuard)
  async getRecommendation(@Param('id') id: string) {
    const market = await this.marketRepo.findOne({ where: { id } });
    if (!market) return { error: 'Market not found' };

    return {
      marketId: market.marketId,
      question: market.question,
      agentPYes: market.pYes,
      agentStakeSide: market.stakeSide,
      confidence: market.confidence,
      resolutionDeadline: market.resolutionDeadline,
    };
  }
}
