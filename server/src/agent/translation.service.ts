import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Article } from '../news/article.entity';
import { StructuredMarket } from './agent.types';

const SYSTEM_PROMPT = `You are a prediction market structuring agent for Meridian, a platform that creates binary prediction markets from non-English financial news.

Given a non-English news article (title + content), produce a JSON object with:
- question: binary prediction question in English (must be answerable YES/NO)
- resolutionCriteria: exact, unambiguous resolution conditions
- resolutionDeadline: ISO8601 date (typically 7-90 days from now)
- oracleTier: 1 (data feed — for FX rates, interest rates) or 2 (admin verification — for policy decisions, elections)
- pYes: calibrated probability 0-1 based on available evidence
- confidence: your confidence in this probability estimate 0-1
- settlementToken: "USDC" or "EURC" based on event currency context (use EURC for European events)
- vertical: "central-bank" | "fx-direction" | "trade-policy"

Only output valid JSON. Never include preamble or explanation.`;

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('anthropic.apiKey');
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — translation disabled');
    }
  }

  /**
   * Translate and structure a news article into a prediction market.
   */
  async structureArticle(
    article: Article,
  ): Promise<StructuredMarket | null> {
    if (!this.client) {
      this.logger.warn('Claude client not initialized');
      return null;
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Source: ${article.sourceName} (${article.sourceLanguage})\nTitle: ${article.title}\nContent: ${article.content?.slice(0, 2000) || 'No content available'}`,
          },
        ],
      });

      const text =
        message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed: StructuredMarket = JSON.parse(text);

      // Attach source metadata
      parsed.sourceLanguage = article.sourceLanguage;
      parsed.sourceName = article.sourceName;

      this.logger.log(`Structured: "${parsed.question}" (p=${parsed.pYes})`);
      return parsed;
    } catch (err) {
      this.logger.error(
        `Failed to structure article "${article.title}": ${err.message}`,
      );
      return null;
    }
  }
}
