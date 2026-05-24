import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { Article } from '../news/article.entity';
import { StructuredMarket } from './agent.types';

function buildSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  return `You are a prediction market structuring agent for Meridian, a platform that creates binary prediction markets from non-English financial news.

TODAY'S DATE: ${today}

Given a non-English news article (title + content), produce a JSON object with:
- question: binary prediction question in English (must be answerable YES/NO)
- resolutionCriteria: exact, unambiguous resolution conditions
- resolutionDeadline: ISO8601 date — MUST be a FUTURE date (between 7 and 90 days from TODAY ${today}). NEVER use dates from the article itself if they are in the past. Always project forward.
- oracleTier: 1 (data feed — for FX rates, interest rates) or 2 (admin verification — for policy decisions, elections)
- pYes: calibrated probability 0-1 based on available evidence
- confidence: your confidence in this probability estimate 0-1
- settlementToken: "USDC" or "EURC" based on event currency context (use EURC for European events)
- vertical: "central-bank" | "fx-direction" | "trade-policy"

CRITICAL: The resolutionDeadline MUST be AFTER ${today}. If the news event has already occurred, frame the question around official confirmation, data release, or follow-up actions that have not yet happened.

If the article is not suitable for a financial prediction market (e.g. celebrity news, sports, entertainment, obituaries), output: {"skip": true}

Only output valid JSON. Never include preamble or explanation.`;
}

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
  async structureArticle(article: Article): Promise<StructuredMarket | null> {
    if (!this.client) {
      this.logger.warn('Claude client not initialized');
      return null;
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: `Source: ${article.sourceName} (${article.sourceLanguage})\nTitle: ${article.title}\nContent: ${article.content?.slice(0, 2000) || 'No content available'}`,
          },
        ],
      });

      const raw =
        message.content[0].type === 'text' ? message.content[0].text : '';

      // Strip markdown fences, then extract first JSON object
      const stripped = raw
        .replace(/^```(?:json)?\s*\n?/i, '')
        .replace(/\n?```\s*$/i, '')
        .trim();
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error(`No JSON in response: ${stripped.slice(0, 100)}`);
      const text = jsonMatch[0];
      const parsed = JSON.parse(text) as StructuredMarket & { skip?: boolean };

      if (parsed.skip) {
        this.logger.log(`Skipped non-financial article: "${article.title}"`);
        return null;
      }

      // Attach source metadata
      parsed.sourceLanguage = article.sourceLanguage;
      parsed.sourceName = article.sourceName;

      // Validate and enforce future resolution deadline
      const deadline = new Date(parsed.resolutionDeadline);
      const now = new Date();
      if (deadline <= now) {
        const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        this.logger.warn(
          `AI returned past deadline ${parsed.resolutionDeadline}, clamping to ${futureDate.toISOString()}`,
        );
        parsed.resolutionDeadline = futureDate.toISOString();
      }

      this.logger.log(
        `Structured: "${parsed.question}" (p=${parsed.pYes}, deadline=${parsed.resolutionDeadline})`,
      );
      return parsed;
    } catch (err) {
      this.logger.error(
        `Failed to structure article "${article.title}": ${err.message}`,
      );
      return null;
    }
  }
}
