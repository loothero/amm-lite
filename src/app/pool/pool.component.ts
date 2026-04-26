import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WalletService } from '../services/wallet.service';
import { NFTService, PairVersion, TransactionStatus } from '../services/nft.service';
import {
  CHAIN_ID,
  ChainIdType,
  CONTRACT_ADDRESSES,
  CHAIN_ID_BY_LABEL,
  CHAIN_ID_BY_NUMBER,
} from '../services/address';
import { Pair } from '../../abi/Pair';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { formatEther } from 'viem';

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
  ownerAddress = signal<string>('');
  poolType = signal<number | null>(null); // 0 = TOKEN, 1 = NFT, 2 = TRADE

  // Quotes
  buyPrice = signal<bigint | null>(null);
  buyError = signal<string>('');
  sellPrice = signal<bigint | null>(null);
  sellQuoteError = signal<string>('');

  // UI state
  isLoading = signal<boolean>(false);
  loadError = signal<string>('');
  selectedBuyId = signal<bigint | null>(null);
  sellTokenId: string = '';
  isBuying = signal<boolean>(false);
  isSelling = signal<boolean>(false);
  txError = signal<string>('');
  txSuccessHash = signal<string>('');

  // Form for re-entering address from this page
  inputAddress: string = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.routeLabel = params.get('label');
      const addr = params.get('address');
      if (addr) {
        this.pairAddress.set(addr);
        this.inputAddress = addr;
        if (this.walletService.isConnected()) {
          this.loadPool();
        }
      }
    });
  }

  /** Returns the connected chain's CHAIN_ID, or the URL's label-derived one as fallback. */
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

  async connectWallet(): Promise<void> {
    await this.walletService.connectWallet();
    if (this.pairAddress()) {
      await this.loadPool();
    }
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
   * Reads pool metadata, inventory, and a buy/sell quote in one pass.
   * Detects v1 vs v2 first to know which ABI to use for the inventory and
   * quote calls (the function names and quote signatures differ).
   */
  async loadPool(): Promise<void> {
    const addr = this.pairAddress();
    if (!addr) return;

    this.isLoading.set(true);
    this.loadError.set('');
    this.txError.set('');
    this.txSuccessHash.set('');
    this.buyError.set('');
    this.sellQuoteError.set('');

    try {
      const publicClient = this.walletService.getPublicClient();
      if (!publicClient) {
        this.loadError.set('No public client available — connect a wallet first.');
        return;
      }

      const version = await this.nftService.detectPairVersion(addr);
      this.pairVersion.set(version);

      const pairAbi = version === 'v1' ? Pair : Pair721;
      const pair = addr as `0x${string}`;

      // Read pool basics in parallel.
      const [nftAddr, owner, ptype] = await Promise.all([
        publicClient.readContract({ address: pair, abi: pairAbi as any, functionName: 'nft', args: [] } as any) as Promise<string>,
        publicClient.readContract({ address: pair, abi: pairAbi as any, functionName: 'owner', args: [] } as any) as Promise<string>,
        publicClient.readContract({ address: pair, abi: pairAbi as any, functionName: 'poolType', args: [] } as any) as Promise<number>,
      ]);
      this.nftContractAddress.set(nftAddr);
      this.ownerAddress.set(owner);
      this.poolType.set(Number(ptype));

      // Inventory: function name differs between v1 and v2.
      const inventory = await publicClient.readContract({
        address: pair,
        abi: pairAbi as any,
        functionName: version === 'v1' ? 'getAllHeldIds' : 'getAllIds',
        args: [],
      } as any) as readonly bigint[];
      this.inventoryIds.set(inventory);
      if (inventory.length > 0) {
        this.selectedBuyId.set(inventory[0]);
      } else {
        this.selectedBuyId.set(null);
      }

      // Token metadata.
      try {
        const [name, symbol] = await Promise.all([
          publicClient.readContract({ address: nftAddr as `0x${string}`, abi: ERC721, functionName: 'name' }) as Promise<string>,
          publicClient.readContract({ address: nftAddr as `0x${string}`, abi: ERC721, functionName: 'symbol' }) as Promise<string>,
        ]);
        this.nftName.set(name);
        this.nftSymbol.set(symbol);
      } catch (e) {
        console.warn('Could not read NFT name/symbol', e);
        this.nftName.set('Unknown');
        this.nftSymbol.set('???');
      }

      // Quotes: only valid for pools of the appropriate type.
      // poolType 0 = TOKEN (only buys NFTs from sellers) → sell quote available
      // poolType 1 = NFT   (only sells NFTs to buyers) → buy quote available
      // poolType 2 = TRADE → both quotes available
      await Promise.all([
        this.refreshBuyQuote(version, pair),
        this.refreshSellQuote(version, pair),
      ]);
    } catch (e) {
      console.error('Error loading pool', e);
      this.loadError.set(`Could not load pool: ${(e as Error).message}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async refreshBuyQuote(version: PairVersion, pair: `0x${string}`): Promise<void> {
    const publicClient = this.walletService.getPublicClient();
    if (!publicClient) return;
    const ptype = this.poolType();
    if (ptype === 0) {
      // TOKEN-only pool: cannot buy from it.
      this.buyPrice.set(null);
      this.buyError.set('This pool only buys NFTs (no inventory to sell).');
      return;
    }
    if (this.inventoryIds().length === 0) {
      this.buyPrice.set(null);
      this.buyError.set('Pool has no NFTs to buy.');
      return;
    }
    try {
      const abi = version === 'v1' ? Pair : Pair721;
      const args = version === 'v1' ? [1n] : [0n, 1n];
      const result = await publicClient.readContract({
        address: pair,
        abi: abi as any,
        functionName: 'getBuyNFTQuote',
        args: args as any,
      } as any) as readonly bigint[];
      // v1: [error, newSpotPrice, newDelta, inputAmount, protocolFee]
      // v2: [error, newSpotPrice, newDelta, inputAmount, protocolFee, royaltyAmount]
      const errCode = Number(result[0]);
      if (errCode !== 0) {
        this.buyPrice.set(null);
        this.buyError.set(`Buy quote error code ${errCode}`);
        return;
      }
      this.buyPrice.set(result[3]);
      this.buyError.set('');
    } catch (e) {
      console.warn('Buy quote failed', e);
      this.buyPrice.set(null);
      this.buyError.set('Buy quote failed.');
    }
  }

  private async refreshSellQuote(version: PairVersion, pair: `0x${string}`): Promise<void> {
    const publicClient = this.walletService.getPublicClient();
    if (!publicClient) return;
    const ptype = this.poolType();
    if (ptype === 1) {
      // NFT-only pool: cannot sell into it.
      this.sellPrice.set(null);
      this.sellQuoteError.set('This pool only sells NFTs (cannot sell into it).');
      return;
    }
    try {
      const abi = version === 'v1' ? Pair : Pair721;
      const args = version === 'v1' ? [1n] : [0n, 1n];
      const result = await publicClient.readContract({
        address: pair,
        abi: abi as any,
        functionName: 'getSellNFTQuote',
        args: args as any,
      } as any) as readonly bigint[];
      const errCode = Number(result[0]);
      if (errCode !== 0) {
        this.sellPrice.set(null);
        this.sellQuoteError.set(`Sell quote error code ${errCode}`);
        return;
      }
      this.sellPrice.set(result[3]);
      this.sellQuoteError.set('');
    } catch (e) {
      console.warn('Sell quote failed', e);
      this.sellPrice.set(null);
      this.sellQuoteError.set('Sell quote failed.');
    }
  }

  formatPrice(price: bigint | null): string {
    if (price === null) return '—';
    try {
      const num = parseFloat(formatEther(price));
      if (num === 0) return '0';
      if (num < 0.000001) return num.toExponential(2);
      if (num < 0.001) return num.toFixed(6);
      if (num < 1) return num.toFixed(4);
      return num.toFixed(4);
    } catch {
      return '—';
    }
  }

  shortInventory(): string {
    const ids = this.inventoryIds();
    if (ids.length === 0) return 'None';
    if (ids.length > 8) return ids.slice(0, 8).map(String).join(', ') + `, … (+${ids.length - 8} more)`;
    return ids.map(String).join(', ');
  }

  poolTypeLabel(): string {
    switch (this.poolType()) {
      case 0: return 'TOKEN (only buys NFTs)';
      case 1: return 'NFT (only sells NFTs)';
      case 2: return 'TRADE (both)';
      default: return 'Unknown';
    }
  }

  async buy(): Promise<void> {
    const id = this.selectedBuyId();
    const price = this.buyPrice();
    const pair = this.pairAddress();
    const version = this.pairVersion();
    if (!id || !price || !pair || !version) return;

    this.isBuying.set(true);
    this.txError.set('');
    this.txSuccessHash.set('');
    try {
      const result = await this.nftService.buyNFT({
        pairAddress: pair,
        nftIds: [id],
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
    if (!pair || !nftAddr || !version || !minOut) return;

    let id: bigint;
    try {
      id = BigInt(this.sellTokenId.trim());
    } catch {
      this.txError.set('Invalid token ID.');
      return;
    }

    this.isSelling.set(true);
    this.txError.set('');
    this.txSuccessHash.set('');
    try {
      const result = await this.nftService.sellNFTs({
        pairAddress: pair,
        nftContract: nftAddr,
        nftIds: [id],
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
