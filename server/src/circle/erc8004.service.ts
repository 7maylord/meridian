import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { WalletsService } from './wallets.service';

const IDENTITY_ABI = [
  'function register(string metadataURI)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
];

const REPUTATION_ABI = [
  'function giveFeedback(uint256 agentId, int128 score, uint8 feedbackType, string tag, string context, string evidence, string notes, bytes32 feedbackHash)',
];

@Injectable()
export class Erc8004Service implements OnModuleInit {
  private readonly logger = new Logger(Erc8004Service.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private agentId: bigint | null = null;

  private get identityRegistry(): string {
    return this.config.get<string>('erc8004.identityRegistry')!;
  }
  private get reputationRegistry(): string {
    return this.config.get<string>('erc8004.reputationRegistry')!;
  }

  constructor(
    private readonly config: ConfigService,
    private readonly wallets: WalletsService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.config.get<string>('arc.rpcUrl');
    if (!rpcUrl) return;

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const storedId = this.config.get<string>('erc8004.agentId');
    if (storedId) {
      this.agentId = BigInt(storedId);
      this.logger.log(`ERC-8004 agent ID: ${this.agentId}`);
      return;
    }

    // Auto-register on first boot if wallet is ready
    if (this.wallets.isReady()) {
      await this.registerAgent();
    } else {
      this.logger.warn('Wallet not ready — ERC-8004 registration deferred');
    }
  }

  async registerAgent(): Promise<void> {
    const metadataUri = this.config.get<string>('erc8004.metadataUri')!;

    try {
      this.logger.log('Registering Meridian agent with ERC-8004 IdentityRegistry...');
      const iface = new ethers.Interface(IDENTITY_ABI);
      const calldata = iface.encodeFunctionData('register', [metadataUri]);

      const txId = await this.wallets.sendContractCall(this.identityRegistry, calldata);
      await this.wallets.waitForTransaction(txId);

      this.logger.log('Registration confirmed — fetching agent ID from Transfer event');
      await this.fetchAgentId();
    } catch (err) {
      this.logger.error(`ERC-8004 registration failed: ${(err as Error).message}`);
    }
  }

  private async fetchAgentId(): Promise<void> {
    const walletAddr = this.wallets.getAddress();
    if (!walletAddr || !this.provider) return;

    const iface = new ethers.Interface(IDENTITY_ABI);
    const transferTopic = iface.getEvent('Transfer')!.topicHash;
    const paddedAddr = ethers.zeroPadValue(walletAddr, 32);

    const latestBlock = await this.provider.getBlockNumber();
    const fromBlock = Math.max(0, latestBlock - 10000);

    const logs = await this.provider.getLogs({
      address: this.identityRegistry,
      topics: [transferTopic, null, paddedAddr],
      fromBlock,
      toBlock: latestBlock,
    });

    if (logs.length === 0) {
      this.logger.warn('No Transfer event found — registration may have failed');
      return;
    }

    const parsed = iface.parseLog(logs[logs.length - 1]);
    this.agentId = parsed!.args.tokenId as bigint;
    this.logger.log(`Agent ID: ${this.agentId}`);
    this.logger.warn(`⚠️  Add to server .env: ERC8004_AGENT_ID=${this.agentId}`);
  }

  getAgentId(): bigint | null {
    return this.agentId;
  }

  /**
   * Record an onchain reputation event after a market resolves.
   * Score is derived from the Brier score: score = round((1 - brierScore) * 100).
   * Must be called from the OWNER wallet — same wallet as the agent uses for trading.
   * Note: in production a separate validator wallet would attest; for hackathon
   * we use the agent wallet directly and note this limitation.
   */
  async recordReputation(
    marketId: number,
    pYes: number,
    outcome: boolean,
  ): Promise<void> {
    if (this.agentId === null || !this.wallets.isReady()) return;

    // Brier score = (prediction - outcome)^2, lower is better
    const prediction = outcome ? pYes : 1 - pYes;
    const brierScore = Math.pow(1 - prediction, 2);
    const score = Math.round((1 - brierScore) * 100);
    const tag = outcome ? 'correct_prediction' : 'incorrect_prediction';
    const feedbackHash = ethers.keccak256(
      ethers.toUtf8Bytes(`meridian_market_${marketId}_${Date.now()}`),
    );

    try {
      const iface = new ethers.Interface(REPUTATION_ABI);
      const calldata = iface.encodeFunctionData('giveFeedback', [
        this.agentId,
        score,
        0,
        tag,
        `market_id:${marketId}`,
        '',
        '',
        feedbackHash,
      ]);

      const txId = await this.wallets.sendContractCall(this.reputationRegistry, calldata);
      await this.wallets.waitForTransaction(txId);
      this.logger.log(
        `Reputation recorded — market ${marketId}: score=${score}, tag=${tag}`,
      );
    } catch (err) {
      this.logger.error(`Reputation record failed: ${(err as Error).message}`);
    }
  }
}
