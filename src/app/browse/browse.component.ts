import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Contract } from 'starknet';
import { WalletService } from '../services/wallet.service';
import { NFTService, TransactionStatus } from '../services/nft.service';
import { CHAIN_ID, ChainIdType, CONTRACT_ADDRESSES, CHAIN_ID_BY_NUMBER, CHAIN_ID_BY_LABEL, normalizeAddress } from '../services/address';
import { ListingBook } from '../../abi/ListingBook';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { parseNftQuote } from '../services/starknet.util';
import { formatTokenAmount } from '../services/format.util';

// Define a type for the listing data
interface ListingData {
  pairAddress: string;
  nftIds: readonly bigint[];
  price: bigint; // Price to buy an NFT (amount from get_buy_nft_quote)
  isBuying?: boolean; // Flag to track if a buy transaction is in progress
}

@Component({
  selector: 'app-browse',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './browse.component.html',
  styleUrl: './browse.component.css'
})
export class BrowseComponent implements OnInit {
  private route = inject(ActivatedRoute);
  walletService = inject(WalletService);
  nftService = inject(NFTService);

  // Route parameters
  label: string | null = null;
  address: string | null = null;

  // Chain information
  chainId: ChainIdType = CHAIN_ID.DEVNET; // Default to DEVNET

  // Listings data
  erc721Listings = signal<string[]>([]);
  listingsData = signal<ListingData[]>([]);

  // Token metadata
  tokenName = signal<string>('');
  tokenSymbol = signal<string>('');

  // Get the current chain ID from the wallet service
  get currentChainId(): ChainIdType {
    const chain = this.walletService.getCurrentChain();
    if (!chain) return CHAIN_ID.DEVNET;
    return CHAIN_ID_BY_NUMBER[chain.id] ?? CHAIN_ID.DEVNET;
  }

  ngOnInit(): void {
    // Subscribe to route params to get label and address
    this.route.paramMap.subscribe(params => {
      this.label = params.get('label');
      this.address = params.get('address');

      // Set the chain ID based on the label
      if (this.label) {
        this.setChainIdFromLabel(this.label);
      }
    });

    // If wallet is already connected, fetch the balance and listings
    if (this.walletService.isConnected()) {
      this.walletService.fetchBalance();

      // If we have an address from the route, fetch the ERC721 listings
      if (this.address) {
        this.fetchERC721Listings(this.address);
      }
    }
  }

  private setChainIdFromLabel(label: string): void {
    const mapped = CHAIN_ID_BY_LABEL[label.toLowerCase()];
    if (mapped) {
      this.chainId = mapped;
    } else {
      this.chainId = CHAIN_ID.DEVNET;
      console.warn(`Unrecognized chain label: ${label}, defaulting to DEVNET`);
    }
  }

  /**
   * Connect wallet using the wallet service
   */
  async connectWallet(): Promise<void> {
    await this.walletService.connectWallet();

    // If we have an address from the route, fetch the ERC721 listings
    if (this.address) {
      await this.fetchERC721Listings(this.address);
    }
  }

  /**
   * Disconnect wallet using the wallet service
   */
  async disconnectWallet(): Promise<void> {
    await this.walletService.disconnectWallet();
  }

  /**
   * Refresh wallet balance
   */
  async refreshBalance(): Promise<void> {
    await this.walletService.fetchBalance();
  }

  /**
   * Fetch all ERC721 listings using the ListingBook contract
   * @param collectionAddress The address of the ERC721 collection
   */
  async fetchERC721Listings(collectionAddress: string): Promise<void> {
    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        console.error('No provider available');
        return;
      }

      // Get the ListingBook contract address for the current chain
      const listingBookAddress = CONTRACT_ADDRESSES[this.currentChainId].LISTING_BOOK;
      if (!listingBookAddress) {
        console.error(`LISTING_BOOK is not configured for ${this.currentChainId}`);
        this.tokenName.set('Unknown Collection');
        this.tokenSymbol.set('???');
        return;
      }

      // ListingBook markets are keyed (collection, quote token). On the EVM
      // original the ETH market was keyed by address(0); the Starknet port
      // has no native ETH, so ETH pools are keyed by the configured ETH
      // ERC20 — query that market. start = 0, end = 0 ("all").
      const tokenAddress = this.walletService.ethTokenAddress();
      const start = 0n;
      const end = 0n;

      console.log('Fetching ERC721 listings and metadata for:', {
        collection: collectionAddress,
        token: tokenAddress,
        start,
        end,
        listingBookAddress
      });

      // Batch the independent reads over the RPC provider.
      const collection = new Contract({ abi: ERC721, address: collectionAddress, providerOrAccount: provider });
      const listingBook = new Contract({ abi: ListingBook, address: listingBookAddress, providerOrAccount: provider });
      // Metadata reads are best-effort: a collection without name/symbol
      // entrypoints (or with reverting ones) must not break listing display.
      const [name, symbol, rawListings] = await Promise.all([
        (collection.call('name', []) as Promise<string>).catch(() => 'Unknown Collection'),
        (collection.call('symbol', []) as Promise<string>).catch(() => '???'),
        listingBook.call('get721_listings', [collectionAddress, tokenAddress, start, end]) as Promise<bigint[]>,
      ]);

      // Pair addresses come back as felts — normalize to canonical hex.
      const listings = rawListings.map(a => normalizeAddress(a));

      console.log('Token metadata:', { name, symbol });
      console.log('ERC721 listings:', listings);

      // Update the token metadata signals
      this.tokenName.set(name);
      this.tokenSymbol.set(symbol);

      // Update the listings signal
      this.erc721Listings.set(listings);

      // If we have listings, fetch the NFT IDs for each pair
      if (listings.length > 0) {
        await this.fetchNFTIdsForPairs(listings);
      }
    } catch (error) {
      console.error('Error fetching ERC721 listings and metadata:', error);
      // Set default values in case of error
      this.tokenName.set('Unknown Collection');
      this.tokenSymbol.set('???');
    }
  }

  /**
   * Fetch NFT IDs and buy quotes for each pair, batched via Promise.all on
   * the RPC provider (replaces the old Multicall contract aggregation).
   * @param pairAddresses Array of pair addresses
   */
  async fetchNFTIdsForPairs(pairAddresses: string[]): Promise<void> {
    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        console.error('No provider available');
        return;
      }

      console.log('Fetching NFT IDs and quotes for pairs:', {
        pairAddresses,
        callsCount: pairAddresses.length * 2
      });

      const listingsWithIds: ListingData[] = await Promise.all(
        pairAddresses.map(async (pairAddress): Promise<ListingData> => {
          try {
            const pair = new Contract({ abi: Pair721, address: pairAddress, providerOrAccount: provider });
            const [nftIds, rawQuote] = await Promise.all([
              pair.call('get_all_ids', []) as Promise<bigint[]>,
              pair.call('get_buy_nft_quote', [0n, 1n]), // asset_id=0, num_nfts=1
            ]);

            // NFTQuote struct fields: (error, new_spot_price, new_delta,
            // amount, protocol_fee, royalty_amount); error != 0 => unavailable.
            const quote = parseNftQuote(rawQuote);
            return {
              pairAddress,
              nftIds,
              price: quote.error === 0 ? quote.amount : 0n,
              isBuying: false
            };
          } catch (error) {
            console.error(`Error reading data for pair ${pairAddress}:`, error);
            return {
              pairAddress,
              nftIds: [],
              price: 0n,
              isBuying: false
            };
          }
        })
      );

      console.log('Listings with NFT IDs and prices:', listingsWithIds);

      // Update the listingsData signal
      this.listingsData.set(listingsWithIds);
    } catch (error) {
      console.error('Error fetching NFT IDs and quotes for pairs:', error);
    }
  }

  formatPrice(price: bigint): string {
    return formatTokenAmount(price);
  }

  /**
   * Get the current token symbol from the wallet service
   * @returns The token symbol for the current chain
   */
  getTokenSymbol(): string {
    const chain = this.walletService.getCurrentChain();
    if (!chain) return 'ETH'; // Default to ETH if no chain is available

    return chain.nativeCurrency.symbol;
  }

  /**
   * Buy the first NFT from a listing
   * @param listing The listing data containing the pair address, NFT IDs, and price
   */
  async buyNFT(listing: ListingData): Promise<void> {
    try {
      // Check if there are any NFTs available
      if (!listing.nftIds.length) {
        console.error('No NFTs available in this listing');
        return;
      }

      // Set the listing as in buying state
      const updatedListings = this.listingsData().map(l =>
        l.pairAddress === listing.pairAddress ? { ...l, isBuying: true } : l
      );
      this.listingsData.set(updatedListings);

      // Subscribe to transaction events
      const statusSubscription = this.nftService.transactionStatus$.subscribe(status => {
        console.log('Transaction status:', status);
      });

      // Call the NFT service to buy the NFT
      const result = await this.nftService.buyNFT({
        pairAddress: listing.pairAddress,
        nftIds: listing.nftIds,
        price: listing.price
      });

      // Unsubscribe from the status updates
      statusSubscription.unsubscribe();

      // If the transaction was successful, refresh the listings
      if (result.status === TransactionStatus.SUCCESS && this.address) {
        await this.fetchERC721Listings(this.address);
      }
    } catch (error) {
      console.error('Error buying NFT:', error);
    } finally {
      // Reset the buying state regardless of success or failure
      const updatedListings = this.listingsData().map(l =>
        l.pairAddress === listing.pairAddress ? { ...l, isBuying: false } : l
      );
      this.listingsData.set(updatedListings);

      // Reset the transaction status in the service
      this.nftService.resetTransactionStatus();
    }
  }
}
