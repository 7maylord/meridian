import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Parser from 'rss-parser';
import { Article } from './article.entity';
import { FEED_REGISTRY, FeedSource } from './feed-registry';

@Injectable()
export class NewsIngestionService {
  private readonly logger = new Logger(NewsIngestionService.name);
  private readonly parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'Meridian-Agent/1.0' },
  });

  constructor(
    @InjectRepository(Article)
    private readonly articleRepo: Repository<Article>,
  ) {}

  /**
   * Poll all feeds every 15 minutes.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async pollAllFeeds(): Promise<Article[]> {
    this.logger.log(`Polling ${FEED_REGISTRY.length} feeds...`);

    const allArticles: Article[] = [];

    for (const feed of FEED_REGISTRY) {
      try {
        const articles = await this.pollFeed(feed);
        allArticles.push(...articles);
      } catch (err) {
        this.logger.warn(`Failed to poll ${feed.name}: ${err.message}`);
      }
    }

    this.logger.log(`Ingested ${allArticles.length} new articles`);
    return allArticles;
  }

  /**
   * Poll a single RSS feed and persist new articles.
   */
  async pollFeed(feed: FeedSource): Promise<Article[]> {
    const parsed = await this.parser.parseURL(feed.url);
    const newArticles: Article[] = [];

    for (const item of parsed.items?.slice(0, 10) ?? []) {
      if (!item.link) continue;

      // Deduplicate by URL
      const exists = await this.articleRepo.findOne({
        where: { url: item.link },
      });
      if (exists) continue;

      const article = this.articleRepo.create({
        url: item.link,
        title: item.title || 'Untitled',
        content: item.contentSnippet || item.content || '',
        sourceLanguage: feed.language,
        sourceName: feed.name,
        publishedAt: item.pubDate ? new Date(item.pubDate) : null,
        processed: false,
      });

      await this.articleRepo.save(article);
      newArticles.push(article);
    }

    return newArticles;
  }

  /**
   * Get unprocessed articles for the translation pipeline.
   */
  async getUnprocessedArticles(limit = 20): Promise<Article[]> {
    return this.articleRepo.find({
      where: { processed: false },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Mark an article as processed.
   */
  async markProcessed(articleId: string): Promise<void> {
    await this.articleRepo.update(articleId, { processed: true });
  }
}
