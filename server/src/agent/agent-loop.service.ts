import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsIngestionService } from '../news/news-ingestion.service';
import { TranslationService } from './translation.service';
import { DecisionEngineService } from './decision-engine.service';
import { MarketFactoryService } from '../markets/market-factory.service';
import { Market, MarketStatus } from '../markets/market.entity';

@Injectable()
export class AgentLoopService {
  private readonly logger = new Logger(AgentLoopService.name);
  private isRunning = false;

  constructor(
    private readonly news: NewsIngestionService,
    private readonly translation: TranslationService,
    private readonly decisionEngine: DecisionEngineService,
    private readonly marketFactory: MarketFactoryService,
    @InjectRepository(Market)
    private readonly marketRepo: Repository<Market>,
  ) {}

  /**
   * Main autonomous loop — runs every 15 minutes.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async runLoop(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Agent loop already running, skipping');
      return;
    }

    this.isRunning = true;
    this.logger.log('=== Agent Loop Starting ===');

    try {
      // Step 1: Get unprocessed articles
      const articles = await this.news.getUnprocessedArticles(10);
      this.logger.log(`Processing ${articles.length} articles`);

      for (const article of articles) {
        try {
          // Step 2: Translate and structure
          const structured =
            await this.translation.structureArticle(article);

          if (!structured) {
            await this.news.markProcessed(article.id);
            continue;
          }

          // Step 3: Duplicate check — skip if identical question already deployed
          const existing = await this.marketRepo.findOne({
            where: { question: structured.question },
          });
          if (existing) {
            this.logger.log(
              `Duplicate question skipped: "${structured.question}"`,
            );
            await this.news.markProcessed(article.id);
            continue;
          }

          // Step 4: Decision engine
          const decision = await this.decisionEngine.evaluate(structured);

          if (!decision.deploy) {
            await this.news.markProcessed(article.id);
            continue;
          }

          // Step 5: Deploy market on-chain
          const { marketId, txHash } = await this.marketFactory.deployMarket(
            structured,
            decision,
          );

          // Step 6: Persist to database
          const market = this.marketRepo.create({
            question: structured.question,
            resolutionCriteria: structured.resolutionCriteria,
            resolutionDeadline: new Date(structured.resolutionDeadline),
            oracleTier: structured.oracleTier,
            pYes: structured.pYes,
            confidence: structured.confidence,
            sourceLanguage: structured.sourceLanguage,
            sourceName: structured.sourceName,
            settlementToken: structured.settlementToken,
            vertical: structured.vertical,
            status: MarketStatus.ACTIVE,
            stakeAmount: decision.stakeAmount / 1e6,
            stakeSide: decision.stakeSide,
            articleId: article.id,
            marketId: Number(marketId),
            txHash: txHash,
          });

          await this.marketRepo.save(market);
          await this.news.markProcessed(article.id);

          this.logger.log(
            `Deployed market: "${structured.question}" | Stake: $${(decision.stakeAmount / 1e6).toFixed(2)} ${decision.stakeSide}`,
          );
        } catch (err) {
          this.logger.error(
            `Failed processing article "${article.title}": ${(err as Error).message}`,
          );
          await this.news.markProcessed(article.id);
        }

        // Throttle to avoid Claude API rate limits between articles
        if (articles.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
      }
    } catch (err) {
      this.logger.error(`Agent loop error: ${(err as Error).message}`);
    } finally {
      this.isRunning = false;
      this.logger.log('=== Agent Loop Complete ===');
    }
  }
}
