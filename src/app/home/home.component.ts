import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Call, Contract } from 'starknet';
import { WalletService } from '../services/wallet.service';
import { ERC721 } from '../../abi/ERC721';
import { ERC20 } from '../../abi/ERC20';
import { CHAIN_ID, CONTRACT_ADDRESSES, ChainIdType, CHAIN_ID_BY_NUMBER, ZERO_ADDRESS } from '../services/address';
import { boolCalldata, u256ArrayCalldata, u256Calldata } from '../services/starknet.util';
import { formatUnits } from '../services/format.util';

/** PoolType wire value (TOKEN=0, NFT=1, TRADE=2) used when creating listings. */
const POOL_TYPE_NFT = '1';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  walletService = inject(WalletService);
  private router = inject(Router);

  // Form properties
  nftContractAddress: string = '';
  nftIds: string = ''; // Comma-separated list of IDs
  tokenContractAddress: string = ''; // Default to empty for the chain's ETH token
  startingPrice: string = '';

  // Pool lookup form
  lookupPoolAddress: string = '';

  networkLabel(): string {
    switch (this.currentChainId) {
      case CHAIN_ID.STARKNET: return 'Starknet';
      case CHAIN_ID.SEPOLIA: return 'Sepolia';
      case CHAIN_ID.DEVNET: return 'Devnet';
      default: return 'Unknown';
    }
  }

  nativeSymbol(): string {
    return this.walletService.getCurrentChain()?.nativeCurrency.symbol ?? 'ETH';
  }

  goToPool(): void {
    if (!this.lookupPoolAddress) return;
    const label = this.networkLabel().toLowerCase();
    this.router.navigate(['/pool', label, this.lookupPoolAddress.trim()]);
  }

  // Chain ids are Starknet felt hex strings (not EVM numbers) since the
  // Starknet port.
  async switchChain(id: string): Promise<void> {
    await this.walletService.switchChain(id);
  }

  get currentChainId(): ChainIdType {
    const chain = this.walletService.getCurrentChain();
    if (!chain) return CHAIN_ID.DEVNET;
    return CHAIN_ID_BY_NUMBER[chain.id] ?? CHAIN_ID.DEVNET;
  }

  /** Pool creation needs the pair factory deployed on the current chain. */
  get creationSupported(): boolean {
    return !!CONTRACT_ADDRESSES[this.currentChainId].PAIR_FACTORY_V2_HOOKS;
  }

  // UI state
  isApproved = signal<boolean>(false);
  isCheckingApproval = signal<boolean>(false);
  errorMessage = signal<string>('');

  // ERC721 NFT state
  nftName = signal<string>('');
  nftSymbol = signal<string>('');
  nftBalance = signal<number>(0);
  isCheckingNFT = signal<boolean>(false);

  // ERC20 token state
  tokenName = signal<string>('');
  tokenSymbol = signal<string>('');
  tokenDecimals = signal<number>(18);
  tokenBalance = signal<string>('0');
  tokenAllowance = signal<string>('0');
  tokenAllowanceRaw = signal<bigint>(0n);
  isTokenApproved = signal<boolean>(false);
  isCheckingToken = signal<boolean>(false);

  /**
   * Format a number in scientific notation
   */
  formatScientific(num: bigint): string {
    if (num === 0n) return '0';

    // Convert to string and then to number for formatting
    const numStr = num.toString();
    const numFloat = parseFloat(numStr);

    // Format in scientific notation
    return numFloat.toExponential(2);
  }

  async connectWallet(): Promise<void> {
    await this.walletService.connectWallet();
  }

  async disconnectWallet(): Promise<void> {
    await this.walletService.disconnectWallet();
  }

  async refreshBalance(): Promise<void> {
    await this.walletService.fetchBalance();
  }

  /**
   * Create a listing. Any missing approvals (NFT set_approval_for_all for
   * the factory, ERC20 allowance for the initial token balance) are batched
   * together with the create_pair call into ONE wallet transaction via
   * account.execute.
   */
  async createListing(): Promise<void> {
    try {
      await this.checkNFTApproval();
      if (this.tokenContractAddress) {
        await this.checkERC20Approval();
      }

      const approvalCalls: Call[] = [];
      if (!this.isApproved()) {
        approvalCalls.push(this.buildNFTApprovalCall());
      }
      if (this.tokenContractAddress && !this.isTokenApproved()) {
        approvalCalls.push(this.buildERC20ApprovalCall());
      }

      // Log the form values
      console.log('Creating listing with:', {
        nftContractAddress: this.nftContractAddress,
        nftIds: this.nftIds.split(',').map(id => id.trim()),
        tokenContractAddress: this.tokenContractAddress || 'ETH token',
        startingPrice: this.startingPrice,
        batchedApprovals: approvalCalls.length
      });

      // Create the pool (approvals + create in a single transaction)
      await this.createPool(approvalCalls);
    } catch (error) {
      console.error('Error creating listing:', error);
      this.errorMessage.set(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the NFT collection has set_approval_for_all for the Pair Factory
   */
  private async checkNFTApproval(): Promise<void> {
    this.isCheckingApproval.set(true);
    this.isApproved.set(false);

    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const walletAddress = this.walletService.walletAddress();
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      const pairFactoryAddress = this.requireAddress('PAIR_FACTORY_V2_HOOKS');

      const nft = new Contract(ERC721, this.nftContractAddress, provider);
      const isApproved = await nft.call('is_approved_for_all', [walletAddress, pairFactoryAddress]) as boolean;

      this.isApproved.set(!!isApproved);
    } catch (error) {
      console.error('Error checking NFT approval:', error);
      throw new Error(`Failed to check NFT approval: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isCheckingApproval.set(false);
    }
  }

  /** set_approval_for_all(factory, true) on the NFT collection. */
  private buildNFTApprovalCall(): Call {
    const pairFactoryAddress = this.requireAddress('PAIR_FACTORY_V2_HOOKS');
    return {
      contractAddress: this.nftContractAddress,
      entrypoint: 'set_approval_for_all',
      calldata: [pairFactoryAddress, boolCalldata(true)],
    };
  }

  /**
   * Check NFT collection details when the NFT contract address changes
   */
  async checkNFTDetails(): Promise<void> {
    if (!this.nftContractAddress) {
      // Reset NFT details if no contract address is provided
      this.nftName.set('');
      this.nftSymbol.set('');
      this.nftBalance.set(0);
      return;
    }

    this.isCheckingNFT.set(true);
    this.errorMessage.set('');

    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const walletAddress = this.walletService.walletAddress();
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Batch the independent reads over the RPC provider.
      const nft = new Contract(ERC721, this.nftContractAddress, provider);
      const [name, symbol, balance] = await Promise.all([
        nft.call('name', []) as Promise<string>,
        nft.call('symbol', []) as Promise<string>,
        nft.call('balance_of', [walletAddress]) as Promise<bigint>,
      ]);

      this.nftName.set(name);
      this.nftSymbol.set(symbol);
      this.nftBalance.set(Number(balance));

      // Check NFT approval status
      await this.checkNFTApproval();
    } catch (error) {
      console.error('Error checking NFT details:', error);
      this.errorMessage.set(`Error checking NFT details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isCheckingNFT.set(false);
    }
  }

  /**
   * Check ERC20 token details when the token address changes
   */
  async checkERC20Details(): Promise<void> {
    if (!this.tokenContractAddress) {
      // Reset token details if no token address is provided
      this.tokenName.set('');
      this.tokenSymbol.set('');
      this.tokenDecimals.set(18);
      this.tokenBalance.set('0');
      this.tokenAllowance.set('0');
      this.isTokenApproved.set(false);
      return;
    }

    this.isCheckingToken.set(true);
    this.errorMessage.set('');

    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const walletAddress = this.walletService.walletAddress();
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      // Batch the independent reads over the RPC provider.
      const token = new Contract(ERC20, this.tokenContractAddress, provider);
      const [name, symbol, decimals, balance] = await Promise.all([
        token.call('name', []) as Promise<string>,
        token.call('symbol', []) as Promise<string>,
        token.call('decimals', []) as Promise<bigint>,
        token.call('balance_of', [walletAddress]) as Promise<bigint>,
      ]);

      this.tokenName.set(name);
      this.tokenSymbol.set(symbol);
      this.tokenDecimals.set(Number(decimals));
      this.tokenBalance.set(formatUnits(balance, Number(decimals)));

      // Check token approval
      await this.checkERC20Approval();
    } catch (error) {
      console.error('Error checking ERC20 details:', error);
      this.errorMessage.set(`Error checking token details: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isCheckingToken.set(false);
    }
  }

  /**
   * Check if the ERC20 token is approved for the Pair Factory
   */
  async checkERC20Approval(): Promise<void> {
    if (!this.tokenContractAddress) return;

    try {
      const provider = this.walletService.getProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const walletAddress = this.walletService.walletAddress();
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      const pairFactoryAddress = this.requireAddress('PAIR_FACTORY_V2_HOOKS');

      const token = new Contract(ERC20, this.tokenContractAddress, provider);
      const allowance = await token.call('allowance', [walletAddress, pairFactoryAddress]) as bigint;

      // Store the raw allowance value
      this.tokenAllowanceRaw.set(allowance);

      // Format the allowance for display
      this.tokenAllowance.set(formatUnits(allowance, this.tokenDecimals()));

      // Consider approved if allowance is greater than 0
      // In a real app, you might want to check if it's greater than the amount needed
      this.isTokenApproved.set(allowance > 0n);
    } catch (error) {
      console.error('Error checking ERC20 approval:', error);
      throw new Error(`Failed to check token approval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Standalone ERC20 approval (bound to the template button). The create
   * flow doesn't need it — createListing() batches missing approvals into
   * the create transaction.
   */
  async setERC20Approval(): Promise<void> {
    if (!this.tokenContractAddress) return;

    const account = this.walletService.getAccount();
    const provider = this.walletService.getProvider();
    if (!account || !provider) {
      throw new Error('No wallet account available');
    }

    const { transaction_hash: hash } = await account.execute([this.buildERC20ApprovalCall()]);
    await provider.waitForTransaction(hash);

    // After approval, check the allowance again
    await this.checkERC20Approval();
  }

  /** approve(factory, max u256) on the ERC20 token. */
  private buildERC20ApprovalCall(): Call {
    const pairFactoryAddress = this.requireAddress('PAIR_FACTORY_V2_HOOKS');
    const maxUint256 = 2n ** 256n - 1n;
    return {
      contractAddress: this.tokenContractAddress,
      entrypoint: 'approve',
      calldata: [pairFactoryAddress, ...u256Calldata(maxUint256)],
    };
  }

  private requireAddress(key: 'PAIR_FACTORY_V2_HOOKS' | 'LINEAR_CURVE_V2' | 'LISTING_BOOK'): string {
    const addr = CONTRACT_ADDRESSES[this.currentChainId][key];
    if (!addr) {
      throw new Error(`${key} is not configured for ${this.currentChainId} — is the deployments file loaded?`);
    }
    return addr;
  }

  private async createPool(approvalCalls: Call[]): Promise<void> {
    const account = this.walletService.getAccount();
    const provider = this.walletService.getProvider();
    if (!account || !provider) {
      throw new Error('No wallet account available');
    }
    const walletAddress = this.walletService.walletAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }

    const pairFactoryAddress = this.requireAddress('PAIR_FACTORY_V2_HOOKS');
    const linearCurve = this.requireAddress('LINEAR_CURVE_V2');
    const listingBook = this.requireAddress('LISTING_BOOK');
    const initialNftIds = this.nftIds.split(',').map(id => BigInt(id.trim()));
    const spotPrice = BigInt(this.startingPrice) * BigInt(1e18); // u128, 18-decimals scalar

    let createCall: Call;
    if (this.tokenContractAddress === '') {
      // create_pair_erc721_eth(nft, bonding_curve, asset_recipient, pool_type,
      //   delta, fee, spot_price, property_checker, initial_nft_ids,
      //   hook_address, referral_address)
      createCall = {
        contractAddress: pairFactoryAddress,
        entrypoint: 'create_pair_erc721_eth',
        calldata: [
          this.nftContractAddress,
          linearCurve,
          walletAddress, // asset_recipient
          POOL_TYPE_NFT, // pool_type enum (felt 0/1/2)
          '0', // delta (u128)
          '0', // fee (u128)
          spotPrice.toString(), // spot_price (u128)
          ZERO_ADDRESS, // property_checker
          ...u256ArrayCalldata(initialNftIds),
          listingBook, // hook_address
          ZERO_ADDRESS, // referral_address
        ],
      };
    } else {
      // create_pair_erc721_erc20(params: CreateERC721ERC20PairParams) —
      // the struct is serialized as its members, in declaration order.
      createCall = {
        contractAddress: pairFactoryAddress,
        entrypoint: 'create_pair_erc721_erc20',
        calldata: [
          this.tokenContractAddress, // token
          this.nftContractAddress, // nft
          linearCurve, // bonding_curve
          walletAddress, // asset_recipient
          POOL_TYPE_NFT, // pool_type enum (felt 0/1/2)
          '0', // delta (u128)
          '0', // fee (u128)
          spotPrice.toString(), // spot_price (u128)
          ZERO_ADDRESS, // property_checker
          ...u256ArrayCalldata(initialNftIds), // initial_nft_ids
          ...u256Calldata(0n), // initial_token_balance
          listingBook, // hook_address
          ZERO_ADDRESS, // referral_address
        ],
      };
    }

    const { transaction_hash: hash } = await account.execute([...approvalCalls, createCall]);
    console.log('Create pool transaction hash:', hash);
    await provider.waitForTransaction(hash);
    await this.walletService.fetchBalance();
  }
}
