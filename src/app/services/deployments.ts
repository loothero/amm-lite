// Runtime deployment configuration for local devnet (katana) environments.
//
// The lssvm2-starknet deploy tooling emits a deployments file
// (`tools/deploy/deployments/katana.json`) with shape:
//   { rpcUrl, chainId, contracts: { factory, router, listingBook,
//     royaltyRegistry, settingsFactory, propertyCheckerFactory, ethToken,
//     curves: {...} }, classHashes, seeds }
//
// The app fetches it at bootstrap from DEPLOYMENTS_URL (copy/symlink the file
// into `public/deployments/` for local dev, or override the URL below) and
// applies it to the DEVNET chain config + contract registry. When the file is
// absent the app keeps its placeholder (empty) devnet addresses and still
// builds/runs — on-chain reads simply fail gracefully until it's provided.

import { CHAIN_ID, CHAIN_ID_BY_NUMBER, CONTRACT_ADDRESSES, normalizeAddress, normalizeChainId } from './address';
import { WalletService } from './wallet.service';

/** Where to fetch the deployments file from (relative to the app base URL). */
export const DEPLOYMENTS_URL = 'deployments/katana.json';

export interface DeploymentsFile {
  rpcUrl?: string;
  chainId?: string;
  contracts?: {
    factory?: string;
    router?: string;
    listingBook?: string;
    royaltyRegistry?: string;
    settingsFactory?: string;
    propertyCheckerFactory?: string;
    ethToken?: string;
    curves?: Record<string, string>;
  };
  classHashes?: Record<string, string>;
  seeds?: unknown;
}

function safeAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return normalizeAddress(value);
  } catch {
    console.warn('deployments: ignoring invalid address', value);
    return undefined;
  }
}

/** Pick a curve address by any of several plausible key spellings. */
function curve(curves: Record<string, string> | undefined, ...keys: string[]): string | undefined {
  if (!curves) return undefined;
  for (const k of keys) {
    if (curves[k]) return safeAddress(curves[k]);
  }
  return undefined;
}

export function applyDeployments(file: DeploymentsFile, walletService: WalletService): void {
  const c = file.contracts ?? {};
  const devnet = CONTRACT_ADDRESSES[CHAIN_ID.DEVNET];

  devnet.PAIR_FACTORY_V2_HOOKS = safeAddress(c.factory) ?? devnet.PAIR_FACTORY_V2_HOOKS;
  devnet.VERY_FAST_ROUTER_V2 = safeAddress(c.router) ?? devnet.VERY_FAST_ROUTER_V2;
  devnet.LISTING_BOOK = safeAddress(c.listingBook) ?? devnet.LISTING_BOOK;
  devnet.ETH_TOKEN = safeAddress(c.ethToken) ?? devnet.ETH_TOKEN;
  devnet.LINEAR_CURVE_V2 = curve(c.curves, 'linear', 'linearCurve', 'LinearCurve') ?? devnet.LINEAR_CURVE_V2;
  devnet.EXPONENTIAL_CURVE_V2 = curve(c.curves, 'exponential', 'exponentialCurve', 'ExponentialCurve') ?? devnet.EXPONENTIAL_CURVE_V2;
  devnet.XYK_CURVE_V2 = curve(c.curves, 'xyk', 'xykCurve', 'XykCurve') ?? devnet.XYK_CURVE_V2;
  devnet.GDA_CURVE_V2 = curve(c.curves, 'gda', 'gdaCurve', 'GDACurve') ?? devnet.GDA_CURVE_V2;

  if (file.chainId) {
    CHAIN_ID_BY_NUMBER[normalizeChainId(file.chainId)] = CHAIN_ID.DEVNET;
  }
  walletService.configureDevnet({ rpcUrl: file.rpcUrl, chainId: file.chainId });
}

/**
 * Fetch and apply the deployments file. Never throws — the app must stay
 * usable (with placeholder devnet addresses) when the file is absent.
 */
export async function loadDeployments(
  walletService: WalletService,
  url: string = DEPLOYMENTS_URL,
): Promise<void> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      console.info(`deployments: ${url} not found (${res.status}); using placeholder devnet config`);
      return;
    }
    const file = (await res.json()) as DeploymentsFile;
    applyDeployments(file, walletService);
    console.info('deployments: applied devnet config from', url);
  } catch (e) {
    console.info('deployments: could not load', url, '- using placeholder devnet config', e);
  }
}
