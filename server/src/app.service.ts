import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  getHello(): string {
    return 'Hello World!';
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async keepAlive(): Promise<void> {
    const url = process.env.PUBLIC_URL;
    if (!url) return;
    try {
      const res = await fetch(`${url}/health`);
      this.logger.debug(`Keep-alive ping → ${res.status}`);
    } catch {
      // Ignore — best-effort
    }
  }
}
