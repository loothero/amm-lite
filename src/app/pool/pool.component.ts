import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../services/wallet.service';
import { NFTService, PairVersion, TransactionStatus } from '../services/nft.service';
import {
  CHAIN_ID,
  ChainIdType,
  CHAIN_ID_BY_LABEL,
  CHAIN_ID_BY_NUMBER,
  ZERO_ADDRESS,
  isAddressEqual,
} from '../services/address';
import { Pair } from '../../abi/Pair';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { ERC20 } from '../../abi/ERC20';
import { PublicClient } from 'viem';
import { formatTokenAmount, shortAddress } from '../services/format.util';

@Component({
  selector: 'app-pool',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pool.component.html',
  styleUrl: './pool.component.css'
})
export class PoolComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  walletService = inject(WalletService);
  nftService = inject(NFTService);

  // URL params
  routeLabel: string | null = null;
  pairAddress = signal<string | null>(null);

  // Detected pool state
  pairVersion = signal<PairVersion | null>(null);
  nftContractAddress = signal<string>('');
  nftName = signal<string>('');
  nftSymbol = signal<string>('');
  inventoryIds = signal<readonly bigint[]>([]);
  inventoryError = signal<string>('');
  nftBalanceInPool = signal<bigint | null>(null);
  ownerAddress = signal<string>('');
  poolType = signal<number | null>(null);

  // Quote-token (the token the pool prices in: native ETH or an ERC20)
  tokenAddress = signal<string>('');
  tokenSymbol = signal<string>('');
  tokenDecimals = signal<number>(18);
  tokenBalanceInPool = signal<bigint | null>(null);

  // Quotes
  buyPrice = signal<bigint | null>(null);
  buyError = signal<string>('');
  sellPrice = signal<bigint | null>(null);
  sellQuoteError = signal<string>('');

  // UI state
  isLoading = signal<boolean>(false);
  loadError = signal<string>('');
  isBuying = signal<boolean>(false);
  isSelling = signal<boolean>(false);
  txError = signal<string>('');
  txSuccessHash = signal<string>('');

  // Buy selection
  selectedBuyIds = signal<bigint[]>([]);
  customBuyIdsInput: string = '';
  customBuyIds = signal<bigint[]>([]);
  effectiveBuyIds = computed<bigint[]>(() => {
    const sel = this.selectedBuyIds();
    const cust = this.customBuyIds();
    // Dedupe (custom ids might overlap with selected)
    const seen = new Set<string>();
    const out: bigint[] = [];
    for (const id of [...sel, ...cust]) {
      const k = id.toString();
      if (!seen.has(k)) { seen.add(k); out.push(id); }
    }
    return out;
  });

  // Sell selection
  sellTokenIdsInput: string = '';
  sellIds = computed<bigint[]>(() => this.parseIdList(this.sellTokenIdsInput));

  // Pool address input form
  inputAddress: string = '';

  // Tracks the (address, chainId) we last fetched for so we don't reload
  // redundantly each time an unrelated signal flips.
  private lastLoadKey = '';

  constructor() {
    // Reactively (re)load whenever any of: pair address, connection state,
    // or the connected chain changes. This handles the auto-reconnect race
    // (wallet finishes reconnecting after ngOnInit) and a chain switch from
    // the header.
    effect(() => {
      const addr = this.pairAddress();
      const connected = this.walletService.isConnected();
      const chainId = this.walletService.currentChainIdNum();
      if (!addr || !connected || chainId === null) return;
      const key = `${addr}|${chainId}`;
      if (key === this.lastLoadKey) return;
      this.lastLoadKey = key;
      void this.loadPool();
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.routeLabel = params.get('label');
      const addr = params.get('address');
      if (addr) {
        this.pairAddress.set(addr);
        this.inputAddress = addr;
      }
    });
  }

  get currentChainId(): ChainIdType {
    const chain = this.walletService.getCurrentChain();
    if (chain) {
      const fromConn = CHAIN_ID_BY_NUMBER[chain.id];
      if (fromConn) return fromConn;
    }
    if (this.routeLabel) {
      const fromLabel = CHAIN_ID_BY_LABEL[this.routeLabel.toLowerCase()];
      if (fromLabel) return fromLabel;
    }
    return CHAIN_ID.ETHEREUM;
  }

  nativeSymbol(): string {
    return this.walletService.getCurrentChain()?.nativeCurrency.symbol ?? 'ETH';
  }

  quoteSymbol(): string {
    return this.tokenAddress() ? (this.tokenSymbol() || 'TOKEN') : this.nativeSymbol();
  }

  shortAddress = shortAddress;

  async connectWallet(): Promise<void> {
    await this.walletService.connectWallet();
    if (this.pairAddress()) await this.loadPool();
  }

  async disconnectWallet(): Promise<void> {
    await this.walletService.disconnectWallet();
  }

  submitAddress(): void {
    if (!this.inputAddress) return;
    const label = this.routeLabel ?? 'ethereum';
    this.router.navigate(['/pool', label, this.inputAddress.trim()]);
  }

  /**
   * Loads pool state in two waves of independent reads. Every read is
   * wrapped in its own try/catch — a revert in one (e.g. getAllIds on a
   * pool with a property checker) does not block any other read.
   */
  async loadPool(): Promise<void> {
    const addr = this.pairAddress();
    if (!addr) return;

    this.resetPoolState();
    this.isLoading.set(true);

    try {
      const publicClient = this.walletService.getPublicClient();
      if (!publicClient) {
        this.loadError.set('No public client available — connect a wallet first.');
        return;
      }

      const version = await this.nftService.detectPairVersion(addr);
      this.pairVersion.set(version);

      const pair = addr as `0x${string}`;
      const pairAbi = version === 'v1' ? Pair : Pair721;

      const [nft, owner, ptype] = await Promise.all([
        this.readPairView<string>(publicClient, pair, pairAbi, 'nft'),
        this.readPairView<string>(publicClient, pair, pairAbi, 'owner'),
        this.readPairView<number>(publicClient, pair, pairAbi, 'poolType'),
      ]);
      if (nft !== undefined) this.nftContractAddress.set(nft);
      if (owner !== undefined) this.ownerAddress.set(owner);
      if (ptype !== undefined) this.poolType.set(Number(ptype));

      await Promise.allSettled([
        this.readInventory(publicClient, pair, pairAbi, version),
        this.readQuoteToken(publicClient, pair, pairAbi),
        this.refreshBuyQuote(publicClient, pairAbi, version),
        this.refreshSellQuote(publicClient, pairAbi, version),
        this.readNativeBalance(publicClient, pair),
      ]);

      const nftAddr = this.nftContractAddress();
      const tokenAddr = this.tokenAddress();
      await Promise.allSettled([
        nftAddr ? this.readNftMetadata(publicClient, nftAddr) : Promise.resolve(),
        nftAddr ? this.readNftBalanceFallback(publicClient, nftAddr, pair) : Promise.resolve(),
        tokenAddr ? this.readErc20Metadata(publicClient, tokenAddr) : Promise.resolve(),
        tokenAddr ? this.readErc20Balance(publicClient, tokenAddr, pair) : Promise.resolve(),
      ]);
    } catch (e) {
      console.error('Error loading pool', e);
      this.loadError.set(`Could not load pool: ${(e as Error).message}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  private resetPoolState(): void {
    this.loadError.set('');
    this.txError.set('');
    this.txSuccessHash.set('');
    this.buyError.set('');
    this.sellQuoteError.set('');
    this.inventoryError.set('');
    this.pairVersion.set(null);
    this.nftContractAddress.set('');
    this.nftName.set('');
    this.nftSymbol.set('');
    this.inventoryIds.set([]);
    this.nftBalanceInPool.set(null);
    this.ownerAddress.set('');
    this.poolType.set(null);
    this.tokenAddress.set('');
    this.tokenSymbol.set('');
    this.tokenDecimals.set(18);
    this.tokenBalanceInPool.set(null);
    this.buyPrice.set(null);
    this.sellPrice.set(null);
    this.selectedBuyIds.set([]);
    this.customBuyIds.set([]);
    this.customBuyIdsInput = '';
    this.sellTokenIdsInput = '';
  }

  private async readPairView<T>(
    publicClient: PublicClient, pair: `0x${string}`, abi: any, fn: string,
  ): Promise<T | undefined> {
    try {
      return await publicClient.readContract({ address: pair, abi, functionName: fn, args: [] } as any) as T;
    } catch (e) {
      console.warn(`Pair ${fn}() reverted:`, e);
      return undefined;
    }
  }

  /** Read two view fields from a contract concurrently, with per-field fallbacks. */
  private async readContractFields<A, B>(
    publicClient: PublicClient, address: `0x${string}`, abi: any,
    fields: [{ fn: string; fallback: A }, { fn: string; fallback: B }],
  ): Promise<[A, B]> {
    const read = async <T>(fn: string, fallback: T): Promise<T> => {
      try {
        return await publicClient.readContract({ address, abi, functionName: fn } as any) as T;
      } catch { return fallback; }
    };
    const [a, b] = await Promise.all([
      read<A>(fields[0].fn, fields[0].fallback),
      read<B>(fields[1].fn, fields[1].fallback),
    ]);
    return [a, b];
  }

  private async readInventory(
    publicClient: PublicClient, pair: `0x${string}`, abi: any, version: PairVersion,
  ): Promise<void> {
    try {
      const inventory = await publicClient.readContract({
        address: pair, abi,
        functionName: version === 'v1' ? 'getAllHeldIds' : 'getAllIds',
        args: [],
      } as any) as readonly bigint[];
      this.inventoryIds.set(inventory);
    } catch (e) {
      console.warn('Inventory read reverted', e);
      this.inventoryError.set('Inventory IDs are not enumerable on this pool.');
    }
  }

  private async readQuoteToken(
    publicClient: PublicClient, pair: `0x${string}`, abi: any,
  ): Promise<void> {
    try {
      const tok = await publicClient.readContract({
        address: pair, abi, functionName: 'token', args: [],
      } as any) as string;
      if (tok && !isAddressEqual(tok, ZERO_ADDRESS)) this.tokenAddress.set(tok);
    } catch {
      // ETH pair — leave tokenAddress empty.
    }
  }

  private async readNativeBalance(publicClient: PublicClient, pair: `0x${string}`): Promise<void> {
    try {
      const bal = await publicClient.getBalance({ address: pair });
      if (!this.tokenAddress()) this.tokenBalanceInPool.set(bal);
    } catch (e) {
      console.warn('Native balance read failed', e);
    }
  }

  private async readNftMetadata(publicClient: PublicClient, nftAddr: string): Promise<void> {
    const [name, symbol] = await this.readContractFields<string, string>(
      publicClient, nftAddr as `0x${string}`, ERC721,
      [{ fn: 'name', fallback: 'Unknown' }, { fn: 'symbol', fallback: '???' }],
    );
    this.nftName.set(name);
    this.nftSymbol.set(symbol);
  }

  private async readNftBalanceFallback(
    publicClient: PublicClient, nftAddr: string, pair: `0x${string}`,
  ): Promise<void> {
    try {
      const bal = await publicClient.readContract({
        address: nftAddr as `0x${string}`,
        abi: ERC721, functionName: 'balanceOf', args: [pair],
      } as any) as bigint;
      this.nftBalanceInPool.set(bal);
    } catch (e) {
      console.warn('NFT balanceOf(pair) failed', e);
    }
  }

  private async readErc20Metadata(publicClient: PublicClient, tokenAddr: string): Promise<void> {
    const [symbol, decimals] = await this.readContractFields<string, number>(
      publicClient, tokenAddr as `0x${string}`, ERC20,
      [{ fn: 'symbol', fallback: 'TOKEN' }, { fn: 'decimals', fallback: 18 }],
    );
    this.tokenSymbol.set(symbol);
    this.tokenDecimals.set(Number(decimals));
  }

  private async readErc20Balance(
    publicClient: PublicClient, tokenAddr: string, pair: `0x${string}`,
  ): Promise<void> {
    try {
      const bal = await publicClient.readContract({
        address: tokenAddr as `0x${string}`,
        abi: ERC20, functionName: 'balanceOf', args: [pair],
      } as any) as bigint;
      this.tokenBalanceInPool.set(bal);
    } catch (e) {
      console.warn('ERC20 balanceOf(pair) failed', e);
    }
  }

  /**
   * Quote count defaults to 1 when nothing is selected, so the page always
   * shows at least the single-item floor / top-bid.
   */
  async refreshBuyQuote(
    publicClient?: PublicClient | null, abi?: any, version?: PairVersion | null,
  ): Promise<void> {
    publicClient ??= this.walletService.getPublicClient();
    version ??= this.pairVersion();
    abi ??= version === 'v1' ? Pair : Pair721;
    const pair = this.pairAddress();
    if (!publicClient || !pair || !version) return;
    await this.fetchQuote(
      publicClient, pair as `0x${string}`, abi, version,
      'getBuyNFTQuote',
      Math.max(1, this.effectiveBuyIds().length),
      this.buyPrice, this.buyError, 'Buy quote unavailable',
    );
  }

  async refreshSellQuote(
    publicClient?: PublicClient | null, abi?: any, version?: PairVersion | null,
  ): Promise<void> {
    publicClient ??= this.walletService.getPublicClient();
    version ??= this.pairVersion();
    abi ??= version === 'v1' ? Pair : Pair721;
    const pair = this.pairAddress();
    if (!publicClient || !pair || !version) return;
    await this.fetchQuote(
      publicClient, pair as `0x${string}`, abi, version,
      'getSellNFTQuote',
      Math.max(1, this.sellIds().length),
      this.sellPrice, this.sellQuoteError, 'Sell quote unavailable',
    );
  }

  private async fetchQuote(
    publicClient: PublicClient, pair: `0x${string}`, abi: any, version: PairVersion,
    fn: 'getBuyNFTQuote' | 'getSellNFTQuote',
    count: number,
    priceSig: { set(v: bigint | null): void },
    errorSig: { set(v: string): void },
    errorPrefix: string,
  ): Promise<void> {
    const args = version === 'v1' ? [BigInt(count)] : [0n, BigInt(count)];
    try {
      const result = await publicClient.readContract({
        address: pair, abi, functionName: fn, args,
      } as any) as readonly bigint[];
      const errCode = Number(result[0]);
      if (errCode !== 0) {
        priceSig.set(null);
        errorSig.set(`${errorPrefix} (curve error ${errCode}).`);
        return;
      }
      // v1: [error, newSpot, newDelta, amount, fee]
      // v2: [error, newSpot, newDelta, amount, fee, royalty]
      priceSig.set(result[3]);
      errorSig.set('');
    } catch (e) {
      console.warn(`${fn} failed`, e);
      priceSig.set(null);
      errorSig.set(`${errorPrefix}.`);
    }
  }

  formatTokenAmount(amount: bigint | null): string {
    return formatTokenAmount(amount, this.tokenDecimals());
  }

  poolTypeLabel(): string {
    switch (this.poolType()) {
      case 0: return 'Buys NFTs';
      case 1: return 'Sells NFTs';
      case 2: return 'Two-sided';
      default: return '—';
    }
  }

  // --- Buy selection helpers ---

  toggleBuyId(id: bigint): void {
    const cur = this.selectedBuyIds();
    const idStr = id.toString();
    const has = cur.some(x => x.toString() === idStr);
    this.selectedBuyIds.set(has ? cur.filter(x => x.toString() !== idStr) : [...cur, id]);
    void this.refreshBuyQuote();
  }

  isBuyIdSelected(id: bigint): boolean {
    const idStr = id.toString();
    return this.selectedBuyIds().some(x => x.toString() === idStr);
  }

  applyCustomBuyIds(): void {
    this.customBuyIds.set(this.parseIdList(this.customBuyIdsInput));
    void this.refreshBuyQuote();
  }

  onSellIdsInputChange(): void {
    void this.refreshSellQuote();
  }

  clearBuySelection(): void {
    this.selectedBuyIds.set([]);
    this.customBuyIds.set([]);
    this.customBuyIdsInput = '';
    void this.refreshBuyQuote();
  }

  private parseIdList(s: string): bigint[] {
    if (!s) return [];
    const parts = s.split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
    const out: bigint[] = [];
    for (const p of parts) {
      try { out.push(BigInt(p)); } catch { /* skip invalid */ }
    }
    return out;
  }

  // --- Tx ---

  async buy(): Promise<void> {
    const ids = this.effectiveBuyIds();
    const price = this.buyPrice();
    const pair = this.pairAddress();
    const version = this.pairVersion();
    if (ids.length === 0 || !price || !pair || !version) return;

    this.isBuying.set(true);
    this.txError.set('');
    this.txSuccessHash.set('');
    try {
      const result = await this.nftService.buyNFT({
        pairAddress: pair,
        nftIds: ids,
        price,
        pairVersion: version,
      });
      if (result.status === TransactionStatus.SUCCESS) {
        this.txSuccessHash.set(result.hash ?? '');
        await this.loadPool();
      } else if (result.error) {
        this.txError.set(result.error.message);
      }
    } finally {
      this.isBuying.set(false);
      this.nftService.resetTransactionStatus();
    }
  }

  async sell(): Promise<void> {
    const pair = this.pairAddress();
    const nftAddr = this.nftContractAddress();
    const version = this.pairVersion();
    const minOut = this.sellPrice();
    const ids = this.sellIds();
    if (!pair || !nftAddr || !version || !minOut || ids.length === 0) return;

    this.isSelling.set(true);
    this.txError.set('');
    this.txSuccessHash.set('');
    try {
      const result = await this.nftService.sellNFTs({
        pairAddress: pair,
        nftContract: nftAddr,
        nftIds: ids,
        minOutput: minOut,
        pairVersion: version,
      });
      if (result.status === TransactionStatus.SUCCESS) {
        this.txSuccessHash.set(result.hash ?? '');
        await this.loadPool();
      } else if (result.error) {
        this.txError.set(result.error.message);
      }
    } finally {
      this.isSelling.set(false);
      this.nftService.resetTransactionStatus();
    }
  }
}
