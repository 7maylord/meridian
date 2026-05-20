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
  private claudeClient: Anthropic | null = null;
  private geminiClient: any | null = null;

  constructor(private readonly config: ConfigService) {
    const claudeKey = this.config.get<string>('anthropic.apiKey');
    if (claudeKey) {
      this.claudeClient = new Anthropic({ apiKey: claudeKey });
    } else {
      this.logger.warn('ANTHROPIC_API_KEY not set — Claude disabled');
    }

    const geminiKey = this.config.get<string>('gemini.apiKey');
    if (geminiKey) {
      // Import dynamically or assume it's available since we installed it
      const { GoogleGenAI } = require('@google/genai');
      this.geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY not set — Gemini disabled');
    }
  }

  /**
   * Translate and structure a news article into a prediction market.
   */
  async structureArticle(
    article: Article,
  ): Promise<StructuredMarket | null> {
    if (!this.claudeClient && !this.geminiClient) {
      this.logger.warn('No AI clients initialized');
      return null;
    }

    const prompt = `Source: ${article.sourceName} (${article.sourceLanguage})\nTitle: ${article.title}\nContent: ${article.content?.slice(0, 2000) || 'No content available'}`;

    try {
      if (this.claudeClient) {
        return await this.callClaude(prompt, article);
      }
      throw new Error('Claude client not available');
    } catch (err) {
      this.logger.warn(`Claude failed: ${err.message}. Trying Gemini...`);
      
      try {
        if (this.geminiClient) {
          return await this.callGemini(prompt, article);
        }
        throw new Error('Gemini client not available');
      } catch (geminiErr) {
        this.logger.error(`Both AI clients failed for "${article.title}". Gemini Error: ${geminiErr.message}`);
        return null;
      }
    }
  }

  private async callClaude(prompt: string, article: Article): Promise<StructuredMarket> {
    const message = await this.claudeClient!.messages.create({
      model: 'claude-sonnet-4-20250514', // using the user's previously set model, note it's deprecated but we keep it
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const parsed: StructuredMarket = JSON.parse(text);

    parsed.sourceLanguage = article.sourceLanguage;
    parsed.sourceName = article.sourceName;

    this.logger.log(`Claude Structured: "${parsed.question}" (p=${parsed.pYes})`);
    return parsed;
  }

  private async callGemini(prompt: string, article: Article): Promise<StructuredMarket> {
    const response = await this.geminiClient!.models.generateContent({
      model: 'gemini-2.5-pro',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
      }
    });

    const text = response.text || '';
    const parsed: StructuredMarket = JSON.parse(text);

    parsed.sourceLanguage = article.sourceLanguage;
    parsed.sourceName = article.sourceName;

    this.logger.log(`Gemini Structured: "${parsed.question}" (p=${parsed.pYes})`);
    return parsed;
  }
}
