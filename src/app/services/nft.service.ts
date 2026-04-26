import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { WalletService } from './wallet.service';
import { Pair721 } from '../../abi/Pair721';
import { Pair } from '../../abi/Pair';
import { ERC721 } from '../../abi/ERC721';
import { PublicClient, WalletClient, Hash } from 'viem';
import { CONTRACT_ADDRESSES, CHAIN_ID_BY_NUMBER } from './address';

export type PairVersion = 'v1' | 'v2';

export enum TransactionStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error'
}

export interface BuyNFTParams {
  pairAddress: string;
  nftIds: readonly bigint[];
  price: bigint;
  pairVersion?: PairVersion;
}

export interface SellNFTParams {
  pairAddress: string;
  nftContract: string;
  nftIds: readonly bigint[];
  minOutput: bigint;
  pairVersion?: PairVersion;
}

export interface TransactionResult {
  status: TransactionStatus;
  hash?: Hash;
  error?: Error;
  pairAddress?: string;
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

@Injectable({
  providedIn: 'root'
})
export class NFTService {
  private transactionStatus = new BehaviorSubject<TransactionStatus>(TransactionStatus.IDLE);
  private transactionStarted = new Subject<{ pairAddress: string }>();
  private transactionPending = new Subject<Hash>();
  private transactionSuccess = new Subject<Hash>();
  private transactionError = new Subject<Error>();
  private transactionComplete = new Subject<TransactionResult>();

  private currentPairAddress: string | null = null;

  constructor(private walletService: WalletService) {}

  public transactionStatus$ = this.transactionStatus.asObservable();
  public transactionStarted$ = this.transactionStarted.asObservable();
  public transactionPending$ = this.transactionPending.asObservable();
  public transactionSuccess$ = this.transactionSuccess.asObservable();
  public transactionError$ = this.transactionError.asObservable();
  public transactionComplete$ = this.transactionComplete.asObservable();

  /**
   * Detects whether a pair contract is a v1 or v2 sudoswap pair by reading
   * its `factory()` address and matching it against the configured factory
   * addresses for the connected chain.
   *
   * Falls back to v2 if no match — most chains in this app are v2-only.
   */
  async detectPairVersion(pairAddress: string): Promise<PairVersion> {
    const publicClient = this.walletService.getPublicClient();
    const chain = this.walletService.getCurrentChain();
    if (!publicClient || !chain) return 'v2';

    const chainKey = CHAIN_ID_BY_NUMBER[chain.id];
    if (!chainKey) return 'v2';
    const addrs = CONTRACT_ADDRESSES[chainKey];

    let factoryAddr: string;
    try {
      factoryAddr = await publicClient.readContract({
        address: pairAddress as `0x${string}`,
        abi: Pair721,
        functionName: 'factory',
      } as any) as string;
    } catch (e) {
      console.warn('Could not read pair factory(), defaulting to v2', e);
      return 'v2';
    }

    const norm = factoryAddr.toLowerCase();
    if (addrs.PAIR_FACTORY && norm === addrs.PAIR_FACTORY.toLowerCase()) return 'v1';
    if (addrs.PAIR_FACTORY_V2 && norm === addrs.PAIR_FACTORY_V2.toLowerCase()) return 'v2';
    if (addrs.PAIR_FACTORY_V2_HOOKS && norm === addrs.PAIR_FACTORY_V2_HOOKS.toLowerCase()) return 'v2';
    return 'v2';
  }

  async buyNFT(params: BuyNFTParams): Promise<TransactionResult> {
    try {
      this.transactionStatus.next(TransactionStatus.PENDING);
      this.currentPairAddress = params.pairAddress;
      this.transactionStarted.next({ pairAddress: params.pairAddress });

      if (!params.nftIds.length) {
        return this.fail(new Error('No NFTs available in this listing'), params.pairAddress);
      }

      const walletClient = this.walletService.getWalletClient();
      const walletAddress = this.walletService.walletAddress();
      if (!walletClient) return this.fail(new Error('No wallet client available'), params.pairAddress);
      if (!walletAddress) return this.fail(new Error('No wallet address available'), params.pairAddress);

      const version = params.pairVersion ?? await this.detectPairVersion(params.pairAddress);
      const abi = version === 'v1' ? Pair : Pair721;

      const hash = await walletClient.writeContract({
        address: params.pairAddress as `0x${string}`,
        abi: abi as any,
        functionName: 'swapTokenForSpecificNFTs',
        args: [
          [params.nftIds[0]],
          params.price,
          walletAddress as `0x${string}`,
          false,
          ZERO_ADDRESS
        ],
        value: params.price,
        chain: this.walletService.getCurrentChain(),
        account: walletAddress as `0x${string}`
      });

      this.transactionPending.next(hash);
      const publicClient = this.walletService.getPublicClient();
      if (publicClient) await this.waitForTransaction(publicClient, hash);
      await this.walletService.fetchBalance();

      return this.succeed(hash, params.pairAddress);
    } catch (error) {
      return this.fail(error as Error, params.pairAddress);
    }
  }

  /**
   * Sell NFTs into a pair pool. Requires the pair to have setApprovalForAll
   * on the NFT contract; this method checks and requests approval first if
   * needed. v1 pairs use the same swapNFTsForToken signature as v2 (no
   * propertyCheckerParams), so we just dispatch on ABI.
   */
  async sellNFTs(params: SellNFTParams): Promise<TransactionResult> {
    try {
      this.transactionStatus.next(TransactionStatus.PENDING);
      this.currentPairAddress = params.pairAddress;
      this.transactionStarted.next({ pairAddress: params.pairAddress });

      if (!params.nftIds.length) {
        return this.fail(new Error('No NFT IDs provided to sell'), params.pairAddress);
      }

      const walletClient = this.walletService.getWalletClient();
      const publicClient = this.walletService.getPublicClient();
      const walletAddress = this.walletService.walletAddress();
      if (!walletClient) return this.fail(new Error('No wallet client available'), params.pairAddress);
      if (!publicClient) return this.fail(new Error('No public client available'), params.pairAddress);
      if (!walletAddress) return this.fail(new Error('No wallet address available'), params.pairAddress);

      // Check setApprovalForAll on the NFT contract for the pair.
      const isApproved = await publicClient.readContract({
        address: params.nftContract as `0x${string}`,
        abi: ERC721,
        functionName: 'isApprovedForAll',
        args: [walletAddress as `0x${string}`, params.pairAddress as `0x${string}`]
      }) as boolean;

      if (!isApproved) {
        const approveHash = await walletClient.writeContract({
          address: params.nftContract as `0x${string}`,
          abi: ERC721,
          functionName: 'setApprovalForAll',
          args: [params.pairAddress as `0x${string}`, true],
          chain: this.walletService.getCurrentChain(),
          account: walletAddress as `0x${string}`
        });
        await this.waitForTransaction(publicClient, approveHash);
      }

      const version = params.pairVersion ?? await this.detectPairVersion(params.pairAddress);
      const abi = version === 'v1' ? Pair : Pair721;

      const hash = await walletClient.writeContract({
        address: params.pairAddress as `0x${string}`,
        abi: abi as any,
        functionName: 'swapNFTsForToken',
        args: [
          [...params.nftIds],
          params.minOutput,
          walletAddress as `0x${string}`,
          false,
          ZERO_ADDRESS
        ],
        chain: this.walletService.getCurrentChain(),
        account: walletAddress as `0x${string}`
      });

      this.transactionPending.next(hash);
      await this.waitForTransaction(publicClient, hash);
      await this.walletService.fetchBalance();

      return this.succeed(hash, params.pairAddress);
    } catch (error) {
      return this.fail(error as Error, params.pairAddress);
    }
  }

  private async waitForTransaction(publicClient: PublicClient, hash: Hash): Promise<void> {
    await publicClient.waitForTransactionReceipt({ hash });
  }

  private succeed(hash: Hash, pairAddress: string): TransactionResult {
    this.transactionSuccess.next(hash);
    const result: TransactionResult = { status: TransactionStatus.SUCCESS, hash, pairAddress };
    this.transactionComplete.next(result);
    this.transactionStatus.next(TransactionStatus.SUCCESS);
    return result;
  }

  private fail(error: Error, pairAddress: string): TransactionResult {
    console.error('Error in NFT transaction:', error);
    this.transactionError.next(error);
    const result: TransactionResult = { status: TransactionStatus.ERROR, error, pairAddress };
    this.transactionComplete.next(result);
    this.transactionStatus.next(TransactionStatus.ERROR);
    return result;
  }

  public resetTransactionStatus(): void {
    this.transactionStatus.next(TransactionStatus.IDLE);
    this.currentPairAddress = null;
  }
}
