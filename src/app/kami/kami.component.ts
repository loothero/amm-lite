import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Contract } from 'starknet';
import { WalletService } from '../services/wallet.service';
import { CHAIN_ID, ChainIdType, CONTRACT_ADDRESSES, CHAIN_ID_BY_NUMBER, normalizeAddress } from '../services/address';
import { ERC721 } from '../../abi/ERC721';

@Component({
  selector: 'app-kami',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kami.component.html',
  styleUrl: './kami.component.css'
})
export class KamiComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  walletService = inject(WalletService);

  // Route parameters
  id: string | null = null;

  // State signals
  isLoading = signal<boolean>(false);
  errorMessage = signal<string>('');
  isWrongNetwork = signal<boolean>(false);

  get currentChainId(): ChainIdType {
    const chain = this.walletService.getCurrentChain();
    if (!chain) return CHAIN_ID.DEVNET;
    return CHAIN_ID_BY_NUMBER[chain.id] ?? CHAIN_ID.DEVNET;
  }

  ngOnInit(): void {
    // Subscribe to route params to get the ID
    this.route.paramMap.subscribe(params => {
      this.id = params.get('id');
      
      // If wallet is already connected, check the network and process the ID
      if (this.walletService.isConnected()) {
        this.checkNetworkAndProcessId();
      }
    });
  }

  /**
   * Check if the user is on the correct network and process the ID
   */
  private async checkNetworkAndProcessId(): Promise<void> {
    // Check we're on a chain with a configured KAMI collection
    if (!CONTRACT_ADDRESSES[this.currentChainId].KAMI) {
      this.isWrongNetwork.set(true);
      this.errorMessage.set('The KAMI collection is not configured on this network.');
      return;
    }

    // Reset the wrong network flag
    this.isWrongNetwork.set(false);

    // If we have an ID, process it
    if (this.id) {
      await this.processKamiId(this.id);
    }
  }

  /**
   * Process the KAMI ID by calling owner_of and redirecting if it's a pool
   */
  private async processKamiId(id: string): Promise<void> {
    try {
      this.isLoading.set(true);
      this.errorMessage.set('');

      // Get the provider
      const provider = this.walletService.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      // Get the KAMI contract address
      const kamiAddress = CONTRACT_ADDRESSES[this.currentChainId].KAMI;
      if (!kamiAddress) {
        throw new Error('KAMI contract address not found');
      }

      console.log(`Calling owner_of(${id}) on KAMI contract at ${kamiAddress}`);

      // Call owner_of on the KAMI contract
      const kami = new Contract(ERC721, kamiAddress, provider);
      const owner = normalizeAddress(await kami.call('owner_of', [BigInt(id)]) as bigint);

      console.log(`Owner of KAMI #${id} is ${owner}`);

      // Redirect to the manage route with the pool address
      this.router.navigate(['/manage', this.currentChainId.toLowerCase(), owner]);
    } catch (error) {
      console.error('Error processing KAMI ID:', error);
      this.errorMessage.set(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Connect wallet using the wallet service
   */
  async connectWallet(): Promise<void> {
    const connected = await this.walletService.connectWallet();
    if (connected) {
      await this.checkNetworkAndProcessId();
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
}
