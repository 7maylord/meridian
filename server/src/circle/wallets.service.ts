import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  initiateDeveloperControlledWalletsClient,
  Blockchain,
} from '@circle-fin/developer-controlled-wallets';

@Injectable()
export class WalletsService implements OnModuleInit {
  private readonly logger = new Logger(WalletsService.name);
  private client: ReturnType<typeof initiateDeveloperControlledWalletsClient>;
  private walletId: string | null = null;
  private walletAddress: string | null = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const apiKey = this.config.get<string>('circle.apiKey');
    const entitySecret = this.config.get<string>('circle.entitySecret');

    if (!apiKey || !entitySecret) {
      this.logger.warn(
        'Circle API credentials not set — wallet operations disabled',
      );
      return;
    }

    this.client = initiateDeveloperControlledWalletsClient({
      apiKey,
      entitySecret,
    });

    // Check if we already have a wallet ID
    const existingWalletId = this.config.get<string>('circle.walletId');
    if (existingWalletId) {
      this.walletId = existingWalletId;
      this.logger.log(`Using existing wallet: ${this.walletId}`);
      await this.loadWalletAddress();
    } else {
      this.logger.log('No wallet ID found — call createWallet() to set up');
    }
  }

  /**
   * Create a new wallet set and wallet for the agent.
   * Call this once, then store the wallet ID in CIRCLE_WALLET_ID env var.
   */
  async createWallet(): Promise<{ walletId: string; address: string }> {
    if (!this.client) throw new Error('Circle client not initialized');

    // Create a wallet set
    const walletSetRes = await this.client.createWalletSet({
      name: 'Meridian Agent Wallets',
    });
    const walletSetId = walletSetRes.data?.walletSet?.id!;
    this.logger.log(`Created wallet set: ${walletSetId}`);

    // Create a wallet in the set
    const walletRes = await this.client.createWallets({
      walletSetId,
      blockchains: [Blockchain.ArcTestnet],
      count: 1,
    });

    const wallet = walletRes.data?.wallets?.[0]!;
    this.walletId = wallet.id!;
    this.walletAddress = wallet.address!;

    this.logger.log(`Created wallet: ${this.walletId}`);
    this.logger.log(`Wallet address: ${this.walletAddress}`);
    this.logger.log(
      `⚠️  Save this in your .env: CIRCLE_WALLET_ID=${this.walletId}`,
    );

    return { walletId: this.walletId, address: this.walletAddress };
  }

  /**
   * Send a contract transaction via the Circle wallet.
   */
  async sendContractCall(
    contractAddress: string,
    calldata: string,
    value = '0',
  ): Promise<string> {
    if (!this.client || !this.walletId) {
      throw new Error('Wallet not initialized');
    }

    const res = await this.client.createContractExecutionTransaction({
      walletId: this.walletId,
      callData: calldata as `0x${string}`,
      contractAddress,
      fee: { type: 'level', config: { feeLevel: 'HIGH' } },
    });

    const txId = res.data?.id ?? 'unknown';
    this.logger.log(`Transaction submitted: ${txId}`);
    return txId;
  }

  /**
   * Get the agent wallet address.
   */
  getAddress(): string | null {
    return this.walletAddress;
  }

  getWalletId(): string | null {
    return this.walletId;
  }

  isReady(): boolean {
    return !!this.client && !!this.walletId;
  }

  private async loadWalletAddress(): Promise<void> {
    if (!this.client || !this.walletId) return;

    try {
      const res = await this.client.getWallet({ id: this.walletId });
      this.walletAddress = res.data?.wallet?.address ?? null;
      this.logger.log(`Wallet address: ${this.walletAddress}`);
    } catch (err) {
      this.logger.error(`Failed to load wallet: ${err.message}`);
    }
  }
}
