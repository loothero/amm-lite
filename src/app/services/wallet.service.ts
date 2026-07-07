import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  connect as getStarknetConnect,
  disconnect as getStarknetDisconnect,
  type StarknetWindowObject,
} from '@starknet-io/get-starknet';
import { constants, RpcProvider, uint256, WalletAccount } from 'starknet';
import {
  ETH_ERC20_ADDRESS,
  normalizeAddress,
  normalizeChainId,
  STARKNET_CHAIN_ID,
} from './address';

export interface ChainConfig {
  /** Normalized Starknet chain id — hex felt of the network shortstring. */
  id: string;
  label: string;
  token: string;
  rpcUrl: string;
  /** Optional explorer URL for display only. */
  explorerUrl?: string;
}

/**
 * Minimal chain descriptor. Kept shape-compatible with the previous viem
 * `Chain` usage in components (`.id`, `.name`, `.nativeCurrency`,
 * `.rpcUrls.default.http`), except `id` is now the Starknet chain id (hex
 * felt string) instead of an EVM number — Starknet chain ids overflow JS
 * numbers.
 */
export interface Chain {
  id: string;
  name: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: { default: { http: string[] } };
}

// TODO(starknet-port, phase 6): legacy viem client surface. The EVM contract
// call sites (page components + nft.service) still call getPublicClient()/
// getWalletClient() and use viem client methods on the result; until those
// call sites are ported to starknet.js the getters always return null, so
// the EVM paths compile unchanged but no-op at runtime.
export type LegacyEvmPublicClient = any;
export type LegacyEvmWalletClient = any;

const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: STARKNET_CHAIN_ID.SN_MAIN,
    label: 'Starknet',
    token: 'ETH',
    rpcUrl: 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8',
    explorerUrl: 'https://voyager.online',
  },
  {
    id: STARKNET_CHAIN_ID.SN_SEPOLIA,
    label: 'Sepolia',
    token: 'ETH',
    rpcUrl: 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8',
    explorerUrl: 'https://sepolia.voyager.online',
  },
  {
    // Local katana devnet (default chain id 'KATANA').
    id: STARKNET_CHAIN_ID.SN_DEVNET,
    label: 'Devnet',
    token: 'ETH',
    rpcUrl: 'http://localhost:5050',
  },
];

const WEI_PER_ETH = 10n ** 18n;

/** Format a u256 wei amount as a decimal ETH string (18 decimals). */
function formatEther(wei: bigint): string {
  const whole = wei / WEI_PER_ETH;
  const frac = wei % WEI_PER_ETH;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fracStr}`;
}

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  public walletAddress = signal<string | null>(null);
  public isConnected = signal<boolean>(false);
  public balance = signal<string>('0');
  /**
   * Current chain id. NOTE: despite the pre-port name this is now the
   * normalized Starknet chain id hex string (a felt, e.g. SN_SEPOLIA =
   * '0x534e5f5345504f4c4941'), not a number — Starknet chain ids overflow
   * JS numbers. The name is kept so existing consumers don't change.
   */
  public currentChainIdNum = signal<string | null>(null);

  public readonly supportedChains: ReadonlyArray<ChainConfig> = SUPPORTED_CHAINS;

  /** The get-starknet wallet (StarknetWindowObject) currently in use. */
  private wallet: StarknetWindowObject | null = null;
  /** starknet.js account bound to the connected wallet, for writes. */
  private account: WalletAccount | null = null;

  constructor() {
    // Try a silent reconnect — get-starknet remembers the last-used wallet
    // and wallet_requestAccounts with silent_mode=true returns the address
    // without prompting if the wallet still authorizes this site.
    void this.tryAutoConnect();
  }

  private readonly onAccountsChanged = (accounts?: string[]): void => {
    if (!accounts || accounts.length === 0) {
      // Wallet locked / access revoked. Keep the wallet object and its
      // listeners so a later unlock reconnects (parity with the previous
      // EIP-1193 behavior).
      this.resetState();
      return;
    }
    this.walletAddress.set(this.safeNormalizeAddress(accounts[0]));
    this.isConnected.set(true);
    this.rebuildAccount();
    void this.fetchBalance();
  };

  private readonly onNetworkChanged = (chainId?: string, accounts?: string[]): void => {
    if (chainId) {
      this.currentChainIdNum.set(normalizeChainId(chainId));
    }
    if (accounts && accounts.length > 0) {
      this.walletAddress.set(this.safeNormalizeAddress(accounts[0]));
    }
    this.rebuildAccount();
    void this.fetchBalance();
  };

  private async tryAutoConnect(): Promise<void> {
    try {
      const wallet = await getStarknetConnect({ modalMode: 'neverAsk' });
      if (!wallet) return;
      await this.completeConnection(wallet, true);
    } catch (e) {
      console.warn('Auto-connect failed', e);
    }
  }

  async connectWallet(): Promise<boolean> {
    try {
      // Opens the get-starknet modal: lists installed Starknet wallets and
      // shows install links when none are present (replaces the old
      // "install MetaMask" alert).
      const wallet = await getStarknetConnect({
        modalMode: 'alwaysAsk',
        modalTheme: 'dark',
      });
      if (!wallet) {
        // No wallet installed or the user closed the modal.
        return false;
      }
      return await this.completeConnection(wallet, false);
    } catch (error) {
      // Includes USER_REFUSED_OP when the user rejects the connect request.
      console.error('Error connecting wallet:', error);
      return false;
    }
  }

  async disconnectWallet(): Promise<void> {
    try {
      // Forget the last-used wallet so tryAutoConnect() doesn't silently
      // reconnect on the next reload.
      await getStarknetDisconnect({ clearLastWallet: true });
    } catch (e) {
      console.warn('get-starknet disconnect failed', e);
    }
    this.detachWalletListeners();
    this.wallet = null;
    this.account = null;
    this.resetState();
  }

  private async completeConnection(
    wallet: StarknetWindowObject,
    silent: boolean,
  ): Promise<boolean> {
    const accounts = await wallet.request({
      type: 'wallet_requestAccounts',
      params: { silent_mode: silent },
    });
    if (!accounts || accounts.length === 0) return false;

    this.detachWalletListeners();
    this.wallet = wallet;
    this.attachWalletListeners();

    this.walletAddress.set(this.safeNormalizeAddress(accounts[0]));
    this.isConnected.set(true);

    try {
      const chainId = await wallet.request({ type: 'wallet_requestChainId' });
      this.currentChainIdNum.set(normalizeChainId(chainId));
    } catch (e) {
      console.warn('Could not read chainId', e);
    }

    this.rebuildAccount();
    await this.fetchBalance();
    return true;
  }

  private attachWalletListeners(): void {
    if (!this.wallet) return;
    this.wallet.on('accountsChanged', this.onAccountsChanged);
    this.wallet.on('networkChanged', this.onNetworkChanged);
  }

  private detachWalletListeners(): void {
    if (!this.wallet) return;
    try {
      this.wallet.off('accountsChanged', this.onAccountsChanged);
      this.wallet.off('networkChanged', this.onNetworkChanged);
    } catch {
      // Some wallets throw when removing unknown listeners — ignore.
    }
  }

  private resetState(): void {
    this.walletAddress.set(null);
    this.isConnected.set(false);
    this.balance.set('0');
    this.account = null;
  }

  /** (Re)create the WalletAccount for the current wallet/address/chain. */
  private rebuildAccount(): void {
    const wallet = this.wallet;
    const address = this.walletAddress();
    const provider = this.getProvider();
    if (!wallet || !address || !provider) {
      this.account = null;
      return;
    }
    this.account = new WalletAccount(provider, wallet, address);
  }

  private safeNormalizeAddress(address: string): string {
    try {
      return normalizeAddress(address);
    } catch {
      return address;
    }
  }

  /**
   * Switch the wallet to a supported chain. If the chain isn't already known
   * to the wallet, try adding it via wallet_addStarknetChain and switch again
   * (parity with the old wallet_switchEthereumChain / 4902 flow). Note that
   * not every Starknet wallet supports custom networks.
   */
  async switchChain(chainId: string): Promise<boolean> {
    const wallet = this.wallet;
    if (!wallet) return false;
    const target = normalizeChainId(chainId);
    const cfg = SUPPORTED_CHAINS.find(c => c.id === target);
    if (!cfg) return false;

    try {
      await wallet.request({
        type: 'wallet_switchStarknetChain',
        params: { chainId: cfg.id },
      });
      return true;
    } catch (e) {
      try {
        await wallet.request({
          type: 'wallet_addStarknetChain',
          params: {
            id: cfg.label.toLowerCase(),
            chain_id: cfg.id,
            chain_name: cfg.label,
            rpc_urls: [cfg.rpcUrl],
            ...(cfg.explorerUrl ? { block_explorer_url: [cfg.explorerUrl] } : {}),
            native_currency: {
              type: 'ERC20',
              options: {
                address: ETH_ERC20_ADDRESS,
                symbol: cfg.token,
                decimals: 18,
                name: cfg.token,
              },
            },
          },
        });
        await wallet.request({
          type: 'wallet_switchStarknetChain',
          params: { chainId: cfg.id },
        });
        return true;
      } catch (addErr) {
        console.error('Failed to switch/add chain', addErr);
        return false;
      }
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
   * starknet.js RpcProvider for reads on the currently connected chain
   * (Starknet replacement for the old viem public client). Returns null when
   * no chain is known or the chain isn't in SUPPORTED_CHAINS.
   */
  getProvider(): RpcProvider | null {
    const id = this.currentChainIdNum();
    if (id === null) return null;
    const cfg = SUPPORTED_CHAINS.find(c => c.id === id);
    if (!cfg) return null;
    return new RpcProvider({
      nodeUrl: cfg.rpcUrl,
      chainId: cfg.id as constants.StarknetChainId,
    });
  }

  /**
   * starknet.js account for writes — wallet-signed transactions via
   * `account.execute(calls)` (Starknet replacement for the old viem wallet
   * client). Returns null when no wallet is connected.
   */
  getAccount(): WalletAccount | null {
    return this.isConnected() ? this.account : null;
  }

  /**
   * @deprecated TODO(starknet-port, phase 6): legacy viem read client —
   * always returns null. Use getProvider() instead. Kept (typed `any`) so
   * the not-yet-ported EVM contract call sites compile and no-op at runtime.
   */
  getPublicClient(): LegacyEvmPublicClient {
    return null;
  }

  /**
   * @deprecated TODO(starknet-port, phase 6): legacy viem write client —
   * always returns null. Use getAccount() instead. Kept (typed `any`) so
   * the not-yet-ported EVM contract call sites compile and no-op at runtime.
   */
  getWalletClient(): LegacyEvmWalletClient {
    return null;
  }

  /**
   * Starknet has no native balance — "ETH" is itself an ERC20 (the fee
   * token). Reads balance_of(wallet) on the canonical ETH contract.
   */
  async fetchBalance(): Promise<void> {
    const addr = this.walletAddress();
    if (!addr) return;
    const provider = this.getProvider();
    if (!provider) return;
    try {
      const result = await this.callBalanceOf(provider, addr);
      const wei = uint256.uint256ToBN({ low: result[0], high: result[1] });
      this.balance.set(formatEther(wei));
    } catch (error) {
      console.error('Error fetching balance:', error);
      this.balance.set('0');
    }
  }

  private async callBalanceOf(provider: RpcProvider, address: string): Promise<string[]> {
    try {
      return await provider.callContract({
        contractAddress: ETH_ERC20_ADDRESS,
        entrypoint: 'balance_of',
        calldata: [address],
      });
    } catch {
      // Older ERC20 deployments only expose the legacy camelCase entrypoint.
      return provider.callContract({
        contractAddress: ETH_ERC20_ADDRESS,
        entrypoint: 'balanceOf',
        calldata: [address],
      });
    }
  }
}
