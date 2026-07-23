import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Contract } from 'starknet';
import { WalletService } from '../services/wallet.service';
import { NFTService, TransactionStatus } from '../services/nft.service';
import { CHAIN_ID, ChainIdType, CHAIN_ID_BY_NUMBER, CHAIN_ID_BY_LABEL, isAddressEqual, normalizeAddress } from '../services/address';
import { Pair721 } from '../../abi/Pair721';
import { ERC721 } from '../../abi/ERC721';
import { parseNftQuote, u256ArrayCalldata } from '../services/starknet.util';
import { formatTokenAmount } from '../services/format.util';

// Define a type for NFT attributes
interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

// Define a type for NFT metadata
interface NFTMetadata {
  name: string;
  image: string;
  attributes: NFTAttribute[];
}

// Define a type for the NFT data with price and metadata
interface NFTData {
  id: bigint;
  price: bigint;
  isBuying?: boolean;
  metadata?: NFTMetadata;
  isLoadingMetadata?: boolean;
  metadataError?: string;
}

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manage.component.html',
  styleUrl: './manage.component.css'
})
export class ManageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  walletService = inject(WalletService);
  nftService = inject(NFTService);

  // Route parameters
  label: string | null = null;
  address: string | null = null;

  // Chain information
  chainId: ChainIdType = CHAIN_ID.DEVNET; // Default to DEVNET

  // NFT IDs data
  nftIds = signal<readonly bigint[]>([]);
  nftDataList = signal<NFTData[]>([]);
  selectedNftId = signal<bigint | null>(null);
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');

  // Withdrawal state
  isWithdrawing = signal<boolean>(false);
  withdrawSuccess = signal<boolean>(false);
  withdrawError = signal<string>('');
  nftContractAddress = signal<string>('');
  isPoolOwner = signal<boolean>(false);

  // Buy state
  nftPrice = signal<bigint>(0n);
  isBuying = signal<boolean>(false);
  buySuccess = signal<boolean>(false);
  buyError = signal<string>('');

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

    // If wallet is already connected, fetch the NFT IDs
    if (this.walletService.isConnected()) {
      this.walletService.fetchBalance();

      // If we have an address from the route, fetch the NFT IDs
      if (this.address) {
        this.fetchNFTIds(this.address);
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

    // If we have an address from the route, fetch the NFT IDs
    if (this.address) {
      await this.fetchNFTIds(this.address);
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
   * Fetch NFT IDs for the pair address
   * @param pairAddress The address of the pair
   */
  async fetchNFTIds(pairAddress: string, preserveTxBanners = false): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set('');
      if (!preserveTxBanners) {
        // Cleared only on (re)navigation — the refresh right after a
        // successful withdraw/buy must not wipe the banner being shown.
        this.withdrawSuccess.set(false);
        this.withdrawError.set('');
      }

      const provider = this.walletService.getProvider();
      if (!provider) {
        this.errorMessage.set('No provider available');
        this.isLoading.set(false);
        return;
      }

      console.log('Fetching NFT IDs for pair:', { pairAddress });

      // Batch the independent pair reads over the RPC provider
      // (replaces the old Multicall contract aggregation).
      const pair = new Contract({ abi: Pair721, address: pairAddress, providerOrAccount: provider });
      const [ids, rawNftAddress, rawQuote, rawOwner] = await Promise.all([
        pair.call('get_all_ids', []) as Promise<bigint[]>,
        pair.call('nft', []) as Promise<bigint>,
        pair.call('get_buy_nft_quote', [0n, 1n]), // asset_id=0, num_nfts=1
        pair.call('owner', []) as Promise<bigint>,
      ]);

      const nftAddress = normalizeAddress(rawNftAddress);
      const ownerAddress = normalizeAddress(rawOwner);

      // NFTQuote struct fields: (error, new_spot_price, new_delta, amount,
      // protocol_fee, royalty_amount); error != 0 => quote unavailable.
      const quote = parseNftQuote(rawQuote);
      const inputAmount = quote.error === 0 ? quote.amount : 0n;

      console.log('NFT IDs for pair:', ids);
      console.log('NFT contract address:', nftAddress);
      console.log('Buy NFT price quote:', inputAmount, quote.error !== 0 ? `(curve error ${quote.errorName})` : '');
      console.log('Pool owner address:', ownerAddress);

      // Check if the current wallet address is the pool owner
      const walletAddress = this.walletService.walletAddress()!;
      const isOwner = isAddressEqual(walletAddress, ownerAddress);

      // Update the signals
      this.nftIds.set(ids);
      this.nftContractAddress.set(nftAddress);
      this.nftPrice.set(inputAmount);
      this.isPoolOwner.set(isOwner);

      // Set the selected NFT ID to the first ID if available
      if (ids.length > 0) {
        this.selectedNftId.set(ids[0]);
      } else {
        this.selectedNftId.set(null);
      }

      // Create NFT data list with initial data
      const nftDataList = ids.map(id => ({
        id,
        price: inputAmount,
        isLoadingMetadata: false,
        metadata: undefined,
        metadataError: undefined
      }));

      this.nftDataList.set(nftDataList);

      // Fetch metadata for all NFTs
      if (ids.length > 0) {
        await this.fetchNFTMetadata(nftAddress as string, nftDataList);
      }
    } catch (error) {
      console.error('Error fetching NFT IDs for pair:', error);
      this.errorMessage.set('Error fetching NFT IDs. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Withdraw all NFTs from the pair
   */
  async withdrawAllNFTs(): Promise<void> {
    if (!this.address || this.nftIds().length === 0) {
      this.withdrawError.set('No NFTs to withdraw');
      return;
    }

    try {
      this.isWithdrawing.set(true);
      this.withdrawSuccess.set(false);
      this.withdrawError.set('');

      const account = this.walletService.getAccount();
      if (!account) {
        this.withdrawError.set('No wallet account available');
        this.isWithdrawing.set(false);
        return;
      }

      const walletAddress = this.walletService.walletAddress();
      if (!walletAddress) {
        this.withdrawError.set('Wallet not connected');
        this.isWithdrawing.set(false);
        return;
      }

      console.log('Withdrawing all NFTs:', {
        pairAddress: this.address,
        nftAddress: this.nftContractAddress(),
        nftIds: this.nftIds(),
        walletAddress
      });

      // Call withdraw_erc721 on the pair contract
      const pairAddress = this.address!; // guarded at method entry
      const { transaction_hash: hash } = await account.execute([{
        contractAddress: pairAddress,
        entrypoint: 'withdraw_erc721',
        calldata: [
          this.nftContractAddress(),
          ...u256ArrayCalldata(this.nftIds()),
        ],
      }]);

      console.log('Withdrawal transaction hash:', hash);

      // Wait for the transaction to be accepted
      const provider = this.walletService.getProvider();
      if (provider) {
        await provider.waitForTransaction(hash);
      }

      // Set success state
      this.withdrawSuccess.set(true);

      // Refresh the NFT IDs after withdrawal (keep the success banner)
      await this.fetchNFTIds(this.address, true);
    } catch (error) {
      console.error('Error withdrawing NFTs:', error);
      this.withdrawError.set('Error withdrawing NFTs. Please try again.');
    } finally {
      this.isWithdrawing.set(false);
    }
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

  formatPrice(price: bigint): string {
    return formatTokenAmount(price);
  }

  /**
   * Buy an NFT from the pair
   * @param nftId Optional NFT ID to buy. If not provided, uses the selected NFT ID.
   */
  async buyNFT(nftId?: bigint): Promise<void> {
    if (!this.address || this.nftIds().length === 0) {
      this.buyError.set('No NFTs available to buy');
      return;
    }

    // Use the provided NFT ID or the selected one
    const selectedId = nftId || this.selectedNftId();
    if (selectedId === null) {
      this.buyError.set('No NFT ID selected to buy');
      return;
    }

    // Set the selected NFT ID to track which one is being purchased
    this.selectedNftId.set(selectedId);

    try {
      this.isBuying.set(true);
      this.buySuccess.set(false);
      this.buyError.set('');

      // Subscribe to transaction events
      const statusSubscription = this.nftService.transactionStatus$.subscribe(status => {
        console.log('Transaction status:', status);
      });

      // Call the NFT service to buy the NFT
      const result = await this.nftService.buyNFT({
        pairAddress: this.address,
        nftIds: [selectedId],
        price: this.nftPrice()
      });

      // Unsubscribe from the status updates
      statusSubscription.unsubscribe();

      // If the transaction was successful, refresh the NFT IDs
      if (result.status === TransactionStatus.SUCCESS && this.address) {
        this.buySuccess.set(true);
        await this.fetchNFTIds(this.address, true);
      }
    } catch (error) {
      console.error('Error buying NFT:', error);
      this.buyError.set('Error buying NFT. Please try again.');
    } finally {
      this.isBuying.set(false);

      // Reset the transaction status in the service
      this.nftService.resetTransactionStatus();
    }
  }

  /**
   * Fetch metadata for all NFTs in the pool
   * @param nftAddress The NFT contract address
   * @param nftDataList The list of NFT data objects
   */
  async fetchNFTMetadata(nftAddress: string, nftDataList: NFTData[]): Promise<void> {
    try {
      console.log('Fetching metadata for NFTs:', {
        nftAddress,
        nftCount: nftDataList.length
      });

      // Process NFTs sequentially to avoid rate limiting
      for (let i = 0; i < nftDataList.length; i++) {
        const nftData = nftDataList[i];

        // Update loading state
        nftData.isLoadingMetadata = true;
        this.nftDataList.update(currentList => {
          const newList = [...currentList];
          newList[i] = { ...nftData };
          return newList;
        });

        try {
          // Fetch tokenURI for this NFT
          const metadata = await this.fetchTokenURI(nftAddress, nftData.id);

          // Update the NFT data with metadata
          nftData.metadata = metadata;
          nftData.isLoadingMetadata = false;

          this.nftDataList.update(currentList => {
            const newList = [...currentList];
            newList[i] = { ...nftData };
            return newList;
          });

          console.log(`Fetched metadata for NFT ID ${nftData.id}:`, metadata);
        } catch (error) {
          console.error(`Error fetching metadata for NFT ID ${nftData.id}:`, error);

          // Update error state
          nftData.isLoadingMetadata = false;
          nftData.metadataError = 'Failed to load metadata';

          this.nftDataList.update(currentList => {
            const newList = [...currentList];
            newList[i] = { ...nftData };
            return newList;
          });
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
    }
  }

  /**
   * Fetch tokenURI for a single NFT
   * @param nftAddress The NFT contract address
   * @param tokenId The token ID
   * @returns The parsed metadata
   */
  async fetchTokenURI(nftAddress: string, tokenId: bigint): Promise<NFTMetadata> {
    const provider = this.walletService.getProvider();
    if (!provider) {
      throw new Error('No provider available');
    }

    // Call token_uri on the NFT contract (fall back to the legacy camelCase
    // tokenURI entrypoint some collections expose instead).
    const nft = new Contract({ abi: ERC721, address: nftAddress, providerOrAccount: provider });
    let tokenURI: string;
    try {
      tokenURI = await nft.call('token_uri', [tokenId]) as string;
    } catch {
      tokenURI = await nft.call('tokenURI', [tokenId]) as string;
    }

    // Parse the metadata
    return this.parseBase64Metadata(tokenURI);
  }

  /**
   * Parse base64 encoded metadata from tokenURI
   * @param tokenURI The token URI string
   * @returns Parsed metadata object
   */
  private parseBase64Metadata(tokenURI: string): NFTMetadata {
    try {
      // Check if this is base64 encoded data
      if (tokenURI.startsWith('data:application/json;base64,')) {
        // Extract the base64 encoded part
        const base64Data = tokenURI.replace('data:application/json;base64,', '');

        // Decode the base64 data
        const jsonString = atob(base64Data);

        // Parse the JSON
        return JSON.parse(jsonString);
      }
      // If it's a URL, we would need to fetch it, but for now we'll return a placeholder
      else {
        console.log('Non-base64 tokenURI detected:', tokenURI);
        return {
          name: `Token #${tokenURI}`,
          image: '',
          attributes: []
        };
      }
    } catch (error) {
      console.error('Error parsing metadata:', error);
      return {
        name: 'Error parsing metadata',
        image: '',
        attributes: []
      };
    }
  }
}
