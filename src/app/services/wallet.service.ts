import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatEther,
  PublicClient,
  WalletClient,
  Chain,
} from 'viem';

interface ChainConfig {
  id: number;
  label: string;
  token: string;
  rpcUrl: string;
  /** Optional explorer URL for display only. */
  explorerUrl?: string;
}

interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<any>;
  on?(event: string, listener: (...args: any[]) => void): void;
  removeListener?(event: string, listener: (...args: any[]) => void): void;
}

const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: 1,
    label: 'Ethereum',
    token: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
  },
  {
    id: parseInt('0x18623A6A54F3F', 16),
    label: 'Yominet',
    token: 'ETH',
    rpcUrl: 'https://jsonrpc-yominet-1.anvil.asia-southeast.initia.xyz/',
  },
];

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  public walletAddress = signal<string | null>(null);
  public isConnected = signal<boolean>(false);
  public balance = signal<string>('0');
  public currentChainIdNum = signal<number | null>(null);

  public readonly supportedChains: ReadonlyArray<ChainConfig> = SUPPORTED_CHAINS;

  constructor() {
    this.attachProviderListeners();
    // Try a silent reconnect — if the wallet remembered the site, eth_accounts
    // returns the address without prompting; otherwise it returns [].
    void this.tryAutoConnect();
  }

  private getProvider(): EIP1193Provider | null {
    const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined;
    return eth ?? null;
  }

  private attachProviderListeners(): void {
    const provider = this.getProvider();
    if (!provider?.on) return;

    provider.on('accountsChanged', (accounts: string[]) => {
      if (!accounts || accounts.length === 0) {
        this.handleDisconnected();
      } else {
        this.walletAddress.set(accounts[0]);
        this.isConnected.set(true);
        void this.fetchBalance();
      }
    });

    provider.on('chainChanged', (chainIdHex: string) => {
      this.currentChainIdNum.set(parseInt(chainIdHex, 16));
      void this.fetchBalance();
    });
  }

  private async tryAutoConnect(): Promise<void> {
    const provider = this.getProvider();
    if (!provider) return;
    try {
      const accounts: string[] = await provider.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        await this.handleConnected(accounts[0]);
      }
    } catch (e) {
      console.warn('Auto-connect failed', e);
    }
  }

  async connectWallet(): Promise<boolean> {
    const provider = this.getProvider();
    if (!provider) {
      alert('No browser wallet detected. Install MetaMask (or another EIP-1193 wallet) and reload.');
      return false;
    }
    try {
      const accounts: string[] = await provider.request({ method: 'eth_requestAccounts' });
      if (!accounts || accounts.length === 0) return false;
      await this.handleConnected(accounts[0]);
      return true;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return false;
    }
  }

  async disconnectWallet(): Promise<void> {
    // EIP-1193 has no real "disconnect" — we just forget the local state.
    this.handleDisconnected();
  }

  private async handleConnected(address: string): Promise<void> {
    this.walletAddress.set(address);
    this.isConnected.set(true);
    try {
      const chainIdHex: string = await this.getProvider()!.request({ method: 'eth_chainId' });
      this.currentChainIdNum.set(parseInt(chainIdHex, 16));
    } catch (e) {
      console.warn('Could not read chainId', e);
    }
    await this.fetchBalance();
  }

  private handleDisconnected(): void {
    this.walletAddress.set(null);
    this.isConnected.set(false);
    this.balance.set('0');
  }

  /**
   * Switch the wallet to a supported chain. If the chain isn't already known
   * to the wallet (error 4902), add it via wallet_addEthereumChain.
   */
  async switchChain(chainIdNum: number): Promise<boolean> {
    const provider = this.getProvider();
    if (!provider) return false;
    const cfg = SUPPORTED_CHAINS.find(c => c.id === chainIdNum);
    if (!cfg) return false;

    const chainIdHex = '0x' + chainIdNum.toString(16);
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainIdHex }],
      });
      return true;
    } catch (e: any) {
      if (e?.code === 4902 || /Unrecognized chain/i.test(e?.message ?? '')) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainIdHex,
              chainName: cfg.label,
              nativeCurrency: { name: cfg.token, symbol: cfg.token, decimals: 18 },
              rpcUrls: [cfg.rpcUrl],
              ...(cfg.explorerUrl ? { blockExplorerUrls: [cfg.explorerUrl] } : {}),
            }],
          });
          return true;
        } catch (addErr) {
          console.error('Failed to add chain', addErr);
          return false;
        }
      }
      console.error('Failed to switch chain', e);
      return false;
    }
  }

  getConnectedWallet(): Observable<string | null> {
    return of(this.walletAddress());
  }

  getCurrentChain(): Chain | null {
    const id = this.currentChainIdNum();
    if (id === null) return null;
    const cfg = SUPPORTED_CHAINS.find(c => c.id === id);
    return {
      id,
      name: cfg?.label ?? `Chain ${id}`,
      nativeCurrency: {
        name: cfg?.token ?? 'ETH',
        symbol: cfg?.token ?? 'ETH',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: [cfg?.rpcUrl ?? ''] },
      },
    };
  }

  /**
   * Public client for reads. Uses the injected wallet's RPC so reads share
   * the user's chosen endpoint (and rate-limit budget). Falls back to http()
   * against the chain's default RPC when no wallet is connected.
   */
  getPublicClient(): PublicClient | null {
    const chain = this.getCurrentChain();
    if (!chain) return null;
    const provider = this.getProvider();
    if (provider) {
      return createPublicClient({ chain, transport: custom(provider) });
    }
    return createPublicClient({ chain, transport: http() });
  }

  getWalletClient(): WalletClient | null {
    const chain = this.getCurrentChain();
    const provider = this.getProvider();
    const account = this.walletAddress();
    if (!chain || !provider || !account) return null;
    return createWalletClient({
      account: account as `0x${string}`,
      chain,
      transport: custom(provider),
    });
  }

  async fetchBalance(): Promise<void> {
    const addr = this.walletAddress();
    if (!addr) return;
    try {
      const publicClient = this.getPublicClient();
      if (!publicClient) return;
      const balanceWei = await publicClient.getBalance({ address: addr as `0x${string}` });
      this.balance.set(formatEther(balanceWei));
    } catch (error) {
      console.error('Error fetching balance:', error);
      this.balance.set('0');
    }
  }
}
