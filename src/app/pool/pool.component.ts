import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CairoCustomEnum, Contract, RpcProvider } from 'starknet';
import { WalletService } from '../services/wallet.service';
import { NFTService, PairVersion, TransactionStatus } from '../services/nft.service';
import {
  CHAIN_ID,
  CONTRACT_ADDRESSES,
  ChainIdType,
  CHAIN_ID_BY_LABEL,
  CHAIN_ID_BY_NUMBER,
  ZERO_ADDRESS,
  isAddressEqual,
  normalizeAddress,
} from '../services/address';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { ERC20 } from '../../abi/ERC20';
import { decodePoolType, parseNftQuote } from '../services/starknet.util';
import { formatTokenAmount, shortAddress } from '../services/format.util';
import { GdaAssessment, MAX_TRADE_FEE, assessGdaTradePool, formatFeePercent } from '../services/gda-safety';

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

  // Curve parameters — read so the GDA TRADE-pool hazard can be surfaced.
  // A GDA pool of type TRADE has no bid/ask spread, so it is round-trip
  // arbitrageable unless its trade fee clears the threshold measured in
  // lssvm2-starknet (see services/gda-safety.ts). Nothing in this app can
  // create such a pool, but one created out-of-band shows up in browse and
  // here, and whoever funded it deserves to be told.
  bondingCurve = signal<string>('');
  poolDelta = signal<bigint | null>(null);
  poolFee = signal<bigint | null>(null);
  gdaWarning = signal<GdaAssessment | null>(null);

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
  private buyQuoteRequest = 0;
  private sellQuoteRequest = 0;

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
  // NOT a computed(): sellTokenIdsInput is a plain ngModel property, not a
  // signal, so a computed would cache the initial empty parse forever and
  // the Sell button could never enable. A method re-parses on each CD cycle.
  sellIds = (): bigint[] => this.parseIdList(this.sellTokenIdsInput);

  /** Property checker address when the pool gates sells; '' = ungated. */
  propertyChecker = signal<string>('');
  /**
   * Raw proof params for gated sells: the Serde of Array<Span<felt252>>
   * (one proof span per sold id, in order), comma/whitespace-separated
   * felts. Range-gated pools accept empty params.
   */
  propertyParamsInput: string = '';
  propertyParams = (): string[] =>
    this.propertyParamsInput
      .split(/[,\s]+/)
      .map((t) => t.trim())
      .filter(Boolean);

  // Pool address input form
  inputAddress: string = '';

  // Tracks the (address, chainId) we last fetched for so we don't reload
  // redundantly each time an unrelated signal flips.
  private lastLoadKey = '';
  private loadRequest = 0;

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
    return CHAIN_ID.STARKNET;
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
    const label = this.routeLabel ?? 'starknet';
    this.router.navigate(['/pool', label, this.inputAddress.trim()]);
  }

  /**
   * Loads pool state in two waves of independent reads. Every read is
   * wrapped in its own try/catch — a revert in one (e.g. get_all_ids on a
   * pool with a property checker) does not block any other read.
   */
  async loadPool(preserveTxBanners = false): Promise<void> {
    const addr = this.pairAddress();
    if (!addr) return;
    const request = ++this.loadRequest;
    const chain = this.walletService.currentChainIdNum();
    const isCurrent = () => request === this.loadRequest
      && addr === this.pairAddress() && chain === this.walletService.currentChainIdNum();

    this.resetPoolState(preserveTxBanners);
    this.isLoading.set(true);

    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        this.loadError.set('No provider available — connect a wallet first.');
        return;
      }

      const version = await this.nftService.detectPairVersion(addr);
      if (!isCurrent()) return;
      this.pairVersion.set(version);

      const pair = addr;

      const [nft, owner, ptype, checker, curve, delta, fee] = await Promise.all([
        this.readPairView<bigint>(provider, pair, 'nft'),
        this.readPairView<bigint>(provider, pair, 'owner'),
        this.readPairView<CairoCustomEnum>(provider, pair, 'pool_type'),
        this.readPairView<bigint>(provider, pair, 'property_checker'),
        this.readPairView<bigint>(provider, pair, 'bonding_curve'),
        this.readPairView<bigint>(provider, pair, 'delta'),
        this.readPairView<bigint>(provider, pair, 'fee'),
      ]);
      if (!isCurrent()) return;
      if (nft !== undefined) this.nftContractAddress.set(normalizeAddress(nft));
      if (owner !== undefined) this.ownerAddress.set(normalizeAddress(owner));
      if (ptype !== undefined) this.poolType.set(decodePoolType(ptype));
      if (curve !== undefined) this.bondingCurve.set(normalizeAddress(curve));
      if (delta !== undefined) this.poolDelta.set(BigInt(delta));
      if (fee !== undefined) this.poolFee.set(BigInt(fee));
      this.assessGdaRisk();
      // Zero checker = ungated; anything else means sells must go through
      // swap_nfts_for_token_with_property_check with proof params.
      if (checker !== undefined && checker !== 0n) {
        this.propertyChecker.set(normalizeAddress(checker));
      }

      await Promise.allSettled([
        this.readInventory(provider, pair, isCurrent).then(() => {
          // A delayed inventory read must not reuse its old provider to quote
          // a newly selected pair/chain, or supersede a newer load's inventory.
          if (isCurrent()) return this.refreshBuyQuote(provider);
          return;
        }),
        this.readQuoteToken(provider, pair),
        this.refreshSellQuote(provider),
        this.readEthBalance(provider, pair),
      ]);
      if (!isCurrent()) return;

      const nftAddr = this.nftContractAddress();
      const tokenAddr = this.tokenAddress();
      await Promise.allSettled([
        nftAddr ? this.readNftMetadata(provider, nftAddr) : Promise.resolve(),
        nftAddr ? this.readNftBalanceFallback(provider, nftAddr, pair) : Promise.resolve(),
        tokenAddr ? this.readErc20Metadata(provider, tokenAddr) : Promise.resolve(),
        tokenAddr ? this.readErc20Balance(provider, tokenAddr, pair) : Promise.resolve(),
      ]);
    } catch (e) {
      if (isCurrent()) {
        console.error('Error loading pool', e);
        this.loadError.set(`Could not load pool: ${(e as Error).message}`);
      }
    } finally {
      if (isCurrent()) this.isLoading.set(false);
    }
  }

  private resetPoolState(preserveTxBanners = false): void {
    // Ignore outstanding quotes from the previous pool/selection.
    this.buyQuoteRequest++;
    this.sellQuoteRequest++;
    this.loadError.set('');
    if (!preserveTxBanners) {
      // Cleared only on navigation — the post-tx refresh must not wipe the
      // success/error banner the user is about to read.
      this.txError.set('');
      this.txSuccessHash.set('');
    }
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
    this.bondingCurve.set('');
    this.poolDelta.set(null);
    this.poolFee.set(null);
    this.gdaWarning.set(null);
    this.tokenAddress.set('');
    this.tokenSymbol.set('');
    this.tokenDecimals.set(18);
    this.tokenBalanceInPool.set(null);
    this.propertyChecker.set('');
    this.buyPrice.set(null);
    this.sellPrice.set(null);
    this.selectedBuyIds.set([]);
    this.customBuyIds.set([]);
    this.customBuyIdsInput = '';
    this.sellTokenIdsInput = '';
  }

  /**
   * Evaluates the GDA TRADE-pool hazard from whatever curve state loaded.
   *
   * Silent unless every input is present: a pair whose `bonding_curve`/`delta`/
   * `fee` reads reverted, or a chain whose GDA address is not configured, gets
   * no warning rather than a guess. Showing this banner against a Linear pool
   * would be worse than missing it.
   */
  private assessGdaRisk(): void {
    const curve = this.bondingCurve();
    const delta = this.poolDelta();
    const fee = this.poolFee();
    const ptype = this.poolType();
    if (!curve || delta === null || fee === null || ptype === null) {
      this.gdaWarning.set(null);
      return;
    }
    const gda = CONTRACT_ADDRESSES[this.currentChainId]?.['GDA_CURVE_V2'] ?? '';
    const assessment = assessGdaTradePool({
      curveAddress: curve,
      gdaCurveAddress: gda,
      poolType: ptype,
      delta,
      fee,
    });
    this.gdaWarning.set(assessment.applies && assessment.unsafe ? assessment : null);
  }

  private async readPairView<T>(
    provider: RpcProvider, pair: string, fn: string,
  ): Promise<T | undefined> {
    try {
      const contract = new Contract({ abi: Pair721, address: pair, providerOrAccount: provider });
      return await contract.call(fn, []) as T;
    } catch (e) {
      console.warn(`Pair ${fn}() reverted:`, e);
      return undefined;
    }
  }

  /** Read two view fields from a contract concurrently, with per-field fallbacks. */
  private async readContractFields<A, B>(
    provider: RpcProvider, address: string, abi: any,
    fields: [{ fn: string; fallback: A }, { fn: string; fallback: B }],
  ): Promise<[A, B]> {
    const contract = new Contract({ abi, address, providerOrAccount: provider });
    const read = async <T>(fn: string, fallback: T): Promise<T> => {
      try {
        return await contract.call(fn, []) as T;
      } catch { return fallback; }
    };
    const [a, b] = await Promise.all([
      read<A>(fields[0].fn, fields[0].fallback),
      read<B>(fields[1].fn, fields[1].fallback),
    ]);
    return [a, b];
  }

  private async readInventory(
    provider: RpcProvider, pair: string, isCurrent: () => boolean,
  ): Promise<void> {
    try {
      const contract = new Contract({ abi: Pair721, address: pair, providerOrAccount: provider });
      const inventory = await contract.call('get_all_ids', []) as readonly bigint[];
      if (!isCurrent()) return;
      this.inventoryIds.set(inventory);
    } catch (e) {
      if (!isCurrent()) return;
      console.warn('Inventory read reverted', e);
      this.inventoryError.set('Inventory IDs are not enumerable on this pool.');
    }
  }

  private async readQuoteToken(provider: RpcProvider, pair: string): Promise<void> {
    try {
      const contract = new Contract({ abi: Pair721, address: pair, providerOrAccount: provider });
      const tok = normalizeAddress(await contract.call('token', []) as bigint);
      // Note: on Starknet "ETH" pools still price in the configured ETH
      // ERC20, so token() is never zero in practice — the pool is displayed
      // as an ERC20 pool whose symbol is ETH.
      if (tok && !isAddressEqual(tok, ZERO_ADDRESS)) this.tokenAddress.set(tok);
    } catch {
      // token() unreadable — leave tokenAddress empty.
    }
  }

  /** ETH-ERC20 balance of the pair (only used when token() is unset/zero). */
  private async readEthBalance(provider: RpcProvider, pair: string): Promise<void> {
    try {
      const eth = new Contract({ abi: ERC20, address: this.walletService.ethTokenAddress(), providerOrAccount: provider });
      const bal = await eth.call('balance_of', [pair]) as bigint;
      if (!this.tokenAddress()) this.tokenBalanceInPool.set(bal);
    } catch (e) {
      console.warn('ETH balance read failed', e);
    }
  }

  private async readNftMetadata(provider: RpcProvider, nftAddr: string): Promise<void> {
    const [name, symbol] = await this.readContractFields<string, string>(
      provider, nftAddr, ERC721,
      [{ fn: 'name', fallback: 'Unknown' }, { fn: 'symbol', fallback: '???' }],
    );
    this.nftName.set(name);
    this.nftSymbol.set(symbol);
  }

  private async readNftBalanceFallback(
    provider: RpcProvider, nftAddr: string, pair: string,
  ): Promise<void> {
    try {
      const contract = new Contract({ abi: ERC721, address: nftAddr, providerOrAccount: provider });
      const bal = await contract.call('balance_of', [pair]) as bigint;
      this.nftBalanceInPool.set(bal);
    } catch (e) {
      console.warn('NFT balance_of(pair) failed', e);
    }
  }

  private async readErc20Metadata(provider: RpcProvider, tokenAddr: string): Promise<void> {
    const [symbol, decimals] = await this.readContractFields<string, number | bigint>(
      provider, tokenAddr, ERC20,
      [{ fn: 'symbol', fallback: 'TOKEN' }, { fn: 'decimals', fallback: 18 }],
    );
    this.tokenSymbol.set(symbol);
    this.tokenDecimals.set(Number(decimals));
  }

  private async readErc20Balance(
    provider: RpcProvider, tokenAddr: string, pair: string,
  ): Promise<void> {
    try {
      const contract = new Contract({ abi: ERC20, address: tokenAddr, providerOrAccount: provider });
      const bal = await contract.call('balance_of', [pair]) as bigint;
      this.tokenBalanceInPool.set(bal);
    } catch (e) {
      console.warn('ERC20 balance_of(pair) failed', e);
    }
  }

  /** Quote the first submitted ERC721 ID, matching the pair's batch royalties. */
  async refreshBuyQuote(provider?: RpcProvider | null): Promise<void> {
    const request = ++this.buyQuoteRequest;
    this.buyPrice.set(null);
    this.buyError.set('');
    const ids = this.effectiveBuyIds();
    // An unselected preview describes the first inventory item, not ID zero.
    const assetId = ids[0] ?? this.inventoryIds()[0];
    if (assetId === undefined) {
      this.buyError.set('Select NFT IDs to get a buy quote.');
      return;
    }
    provider ??= this.walletService.getProvider();
    const pair = this.pairAddress();
    const chain = this.walletService.currentChainIdNum();
    if (!provider || !pair) return;
    await this.fetchQuote(
      provider, pair, 'get_buy_nft_quote', assetId, Math.max(1, ids.length),
      this.buyPrice, this.buyError, 'Buy quote unavailable',
      () => request === this.buyQuoteRequest && pair === this.pairAddress()
        && chain === this.walletService.currentChainIdNum(),
    );
  }

  async refreshSellQuote(provider?: RpcProvider | null): Promise<void> {
    const request = ++this.sellQuoteRequest;
    this.sellPrice.set(null);
    this.sellQuoteError.set('');
    const ids = this.sellIds();
    if (ids.length === 0) {
      this.sellQuoteError.set('Enter NFT IDs to get a sell quote.');
      return;
    }
    provider ??= this.walletService.getProvider();
    const pair = this.pairAddress();
    const chain = this.walletService.currentChainIdNum();
    if (!provider || !pair) return;
    await this.fetchQuote(
      provider, pair, 'get_sell_nft_quote', ids[0], ids.length,
      this.sellPrice, this.sellQuoteError, 'Sell quote unavailable',
      () => request === this.sellQuoteRequest && pair === this.pairAddress()
        && chain === this.walletService.currentChainIdNum(),
    );
  }

  private async fetchQuote(
    provider: RpcProvider, pair: string,
    fn: 'get_buy_nft_quote' | 'get_sell_nft_quote',
    assetId: bigint,
    count: number,
    priceSig: { set(v: bigint | null): void },
    errorSig: { set(v: string): void },
    errorPrefix: string,
    isCurrent: () => boolean,
  ): Promise<void> {
    try {
      const contract = new Contract({ abi: Pair721, address: pair, providerOrAccount: provider });
      const quote = parseNftQuote(await contract.call(fn, [assetId, BigInt(count)]));
      if (!isCurrent()) return;
      if (quote.error !== 0) {
        priceSig.set(null);
        errorSig.set(`${errorPrefix} (curve error ${quote.error}).`);
        return;
      }
      priceSig.set(quote.amount);
      errorSig.set('');
    } catch (e) {
      if (!isCurrent()) return;
      console.warn(`${fn} failed`, e);
      priceSig.set(null);
      errorSig.set(`${errorPrefix}.`);
    }
  }

  formatTokenAmount(amount: bigint | null): string {
    return formatTokenAmount(amount, this.tokenDecimals());
  }

  /** Renders a 1e18-base fee multiplier as a percentage, for the GDA banner. */
  /** The pair's 50% trade-fee ceiling, for the undefendable-pool banner. */
  readonly maxTradeFee = MAX_TRADE_FEE;

  formatFee(fee: bigint): string {
    return formatFeePercent(fee);
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
        await this.loadPool(true);
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
        // Gated pool: route through the property-checked entrypoint with
        // the user-supplied proof params (may be empty for range checkers).
        propertyCheckerParams: this.propertyChecker() ? this.propertyParams() : undefined,
      });
      if (result.status === TransactionStatus.SUCCESS) {
        this.txSuccessHash.set(result.hash ?? '');
        await this.loadPool(true);
      } else if (result.error) {
        this.txError.set(result.error.message);
      }
    } finally {
      this.isSelling.set(false);
      this.nftService.resetTransactionStatus();
    }
  }
}
