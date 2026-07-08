import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { Call, Contract } from 'starknet';
import { WalletService } from './wallet.service';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { CONTRACT_ADDRESSES, CHAIN_ID_BY_NUMBER, isAddressEqual, normalizeAddress } from './address';
import { boolCalldata, u256ArrayCalldata, u256Calldata } from './starknet.util';

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
  hash?: string;
  error?: Error;
  pairAddress?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NFTService {
  private transactionStatus = new BehaviorSubject<TransactionStatus>(TransactionStatus.IDLE);
  private transactionStarted = new Subject<{ pairAddress: string }>();
  private transactionPending = new Subject<string>();
  private transactionSuccess = new Subject<string>();
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
   * Detects the pair variant by reading its `factory()` address and matching
   * it against the configured factory addresses for the connected chain.
   * The Starknet deployment is v2(-hooks)-only, so anything that doesn't
   * match a legacy v1 factory resolves to 'v2'.
   */
  async detectPairVersion(pairAddress: string): Promise<PairVersion> {
    const provider = this.walletService.getProvider();
    const chain = this.walletService.getCurrentChain();
    if (!provider || !chain) return 'v2';

    const chainKey = CHAIN_ID_BY_NUMBER[chain.id];
    if (!chainKey) return 'v2';
    const addrs = CONTRACT_ADDRESSES[chainKey];

    let factoryAddr: string;
    try {
      const pair = new Contract({ abi: Pair721, address: pairAddress, providerOrAccount: provider });
      factoryAddr = normalizeAddress(await pair.call('factory', []) as bigint);
    } catch (e) {
      console.warn('Could not read pair factory(), defaulting to v2', e);
      return 'v2';
    }

    if (addrs.PAIR_FACTORY && isAddressEqual(factoryAddr, addrs.PAIR_FACTORY)) return 'v1';
    if (addrs.PAIR_FACTORY_V2 && isAddressEqual(factoryAddr, addrs.PAIR_FACTORY_V2)) return 'v2';
    if (addrs.PAIR_FACTORY_V2_HOOKS && isAddressEqual(factoryAddr, addrs.PAIR_FACTORY_V2_HOOKS)) return 'v2';
    return 'v2';
  }

  /**
   * Buy specific NFTs from a pair. On Starknet the pair pulls the quote
   * token (the configured ETH ERC20 for "ETH" pools) via transfer_from, so
   * the exact-amount ERC20 approve and the swap are batched into ONE wallet
   * transaction via account.execute — no separate approval transaction.
   */
  async buyNFT(params: BuyNFTParams): Promise<TransactionResult> {
    try {
      this.transactionStatus.next(TransactionStatus.PENDING);
      this.currentPairAddress = params.pairAddress;
      this.transactionStarted.next({ pairAddress: params.pairAddress });

      if (!params.nftIds.length) {
        return this.fail(new Error('No NFTs available in this listing'), params.pairAddress);
      }

      const account = this.walletService.getAccount();
      const provider = this.walletService.getProvider();
      const walletAddress = this.walletService.walletAddress();
      if (!account) return this.fail(new Error('No wallet account available'), params.pairAddress);
      if (!provider) return this.fail(new Error('No provider available'), params.pairAddress);
      if (!walletAddress) return this.fail(new Error('No wallet address available'), params.pairAddress);

      // The token the pair prices in (the configured ETH ERC20 for ETH pairs).
      const pair = new Contract({ abi: Pair721, address: params.pairAddress, providerOrAccount: provider });
      const tokenAddress = normalizeAddress(await pair.call('token', []) as bigint);

      const calls: Call[] = [
        {
          contractAddress: tokenAddress,
          entrypoint: 'approve',
          calldata: [params.pairAddress, ...u256Calldata(params.price)],
        },
        {
          contractAddress: params.pairAddress,
          entrypoint: 'swap_token_for_specific_nfts',
          calldata: [
            ...u256ArrayCalldata(params.nftIds),
            ...u256Calldata(params.price), // max_expected_token_input
            walletAddress, // nft_recipient
            boolCalldata(false), // is_router
            '0', // router_caller
          ],
        },
      ];

      const { transaction_hash: hash } = await account.execute(calls);
      this.transactionPending.next(hash);
      await provider.waitForTransaction(hash);
      await this.walletService.fetchBalance();

      return this.succeed(hash, params.pairAddress);
    } catch (error) {
      return this.fail(error as Error, params.pairAddress);
    }
  }

  /**
   * Sell NFTs into a pair pool. The pair needs set_approval_for_all on the
   * NFT contract; when it's missing, the approval and the swap are batched
   * into ONE wallet transaction via account.execute.
   */
  async sellNFTs(params: SellNFTParams): Promise<TransactionResult> {
    try {
      this.transactionStatus.next(TransactionStatus.PENDING);
      this.currentPairAddress = params.pairAddress;
      this.transactionStarted.next({ pairAddress: params.pairAddress });

      if (!params.nftIds.length) {
        return this.fail(new Error('No NFT IDs provided to sell'), params.pairAddress);
      }

      const account = this.walletService.getAccount();
      const provider = this.walletService.getProvider();
      const walletAddress = this.walletService.walletAddress();
      if (!account) return this.fail(new Error('No wallet account available'), params.pairAddress);
      if (!provider) return this.fail(new Error('No provider available'), params.pairAddress);
      if (!walletAddress) return this.fail(new Error('No wallet address available'), params.pairAddress);

      // Check set_approval_for_all on the NFT contract for the pair.
      const nft = new Contract({ abi: ERC721, address: params.nftContract, providerOrAccount: provider });
      const isApproved = await nft.call('is_approved_for_all', [walletAddress, params.pairAddress]) as boolean;

      const calls: Call[] = [];
      if (!isApproved) {
        calls.push({
          contractAddress: params.nftContract,
          entrypoint: 'set_approval_for_all',
          calldata: [params.pairAddress, boolCalldata(true)],
        });
      }
      calls.push({
        contractAddress: params.pairAddress,
        entrypoint: 'swap_nfts_for_token',
        calldata: [
          ...u256ArrayCalldata(params.nftIds),
          ...u256Calldata(params.minOutput), // min_expected_token_output
          walletAddress, // token_recipient
          boolCalldata(false), // is_router
          '0', // router_caller
        ],
      });

      const { transaction_hash: hash } = await account.execute(calls);
      this.transactionPending.next(hash);
      await provider.waitForTransaction(hash);
      await this.walletService.fetchBalance();

      return this.succeed(hash, params.pairAddress);
    } catch (error) {
      return this.fail(error as Error, params.pairAddress);
    }
  }

  private succeed(hash: string, pairAddress: string): TransactionResult {
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
