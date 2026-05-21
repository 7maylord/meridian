import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletsService } from '../circle/wallets.service';
import { BlockchainService } from '../blockchain/blockchain.service';

const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const PRICE_PER_CALL_USDC = 0.01; // $0.01 per premium API call

@Injectable()
export class NanopaymentGuard implements CanActivate {
  private readonly usedTxHashes = new Set<string>();

  constructor(
    private readonly wallets: WalletsService,
    private readonly blockchain: BlockchainService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
    }>();

    const txHash = req.headers['x-payment-tx'];
    if (!txHash) {
      throw new HttpException(
        {
          error: 'Payment required',
          instructions: `Send ≥$${PRICE_PER_CALL_USDC} USDC to ${this.wallets.getAddress()} on Arc testnet, then retry with the tx hash in X-Payment-Tx header`,
          recipient: this.wallets.getAddress(),
          minAmount: PRICE_PER_CALL_USDC,
          token: this.config.get<string>('contracts.usdc'),
          chainId: this.config.get<number>('arc.chainId'),
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (this.usedTxHashes.has(txHash)) {
      throw new HttpException(
        { error: 'Payment already used' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const valid = await this.verifyPayment(txHash);
    if (!valid) {
      throw new HttpException(
        {
          error: 'Payment not verified',
          details: `Could not confirm ≥$${PRICE_PER_CALL_USDC} USDC transfer to agent wallet in tx ${txHash}`,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    this.usedTxHashes.add(txHash);
    return true;
  }

  private async verifyPayment(txHash: string): Promise<boolean> {
    try {
      const provider = this.blockchain.getProvider();
      const receipt = await provider.getTransactionReceipt(txHash);
      if (!receipt || receipt.status !== 1) return false;

      const agentAddr = this.wallets.getAddress()?.toLowerCase();
      if (!agentAddr) return false;

      const usdcAddr = this.config.get<string>('contracts.usdc')!.toLowerCase();
      const minAmount = BigInt(Math.floor(PRICE_PER_CALL_USDC * 1e6));

      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() !== usdcAddr ||
          log.topics[0] !== ERC20_TRANSFER_TOPIC ||
          log.topics.length < 3
        ) {
          continue;
        }

        const to = '0x' + log.topics[2].slice(26);
        if (to.toLowerCase() !== agentAddr) continue;

        const amount = BigInt(log.data);
        if (amount >= minAmount) return true;
      }

      return false;
    } catch {
      return false;
    }
  }
}
