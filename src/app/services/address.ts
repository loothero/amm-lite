// Chain and address utilities for the Starknet port.
//
// Starknet addresses are felts: variable-length hex strings with no EIP-55
// checksum casing. The canonical form used for display and comparison is the
// 0x-prefixed, zero-padded, 64-hex-digit (66 chars total) lowercase string.
// NEVER compare addresses with `a.toLowerCase() === b.toLowerCase()` (the
// old EVM pattern) — the same felt can be written with or without leading
// zeros. Use `isAddressEqual()` / `normalizeAddress()` below instead.

import { constants, shortString, validateAndParseAddress } from 'starknet';

// ---------------------------------------------------------------------------
// Felt-address utilities
// ---------------------------------------------------------------------------

/** Canonical zero address (0x + 64 zero hex digits). */
export const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Normalize a felt address to its canonical form: `0x` + 64 lowercase hex
 * digits (66 chars). Throws on non-hex input or out-of-range felts.
 */
export function normalizeAddress(address: string): string {
  return validateAndParseAddress(address);
}

/**
 * Compare two Starknet addresses by normalized felt value. Replaces the
 * EVM-era `a.toLowerCase() === b.toLowerCase()` pattern. Returns false
 * (instead of throwing) when either side is missing or not a valid felt.
 */
export function isAddressEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  try {
    return validateAndParseAddress(a) === validateAndParseAddress(b);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Chain identity
// ---------------------------------------------------------------------------

/**
 * Starknet chain ids are felts encoding a shortstring (e.g. 'SN_MAIN' =
 * 0x534e5f4d41494e). Normalize to minimal lowercase hex so ids reported by
 * different wallets/RPCs compare with plain `===`.
 */
export function normalizeChainId(chainId: string | number | bigint): string {
  try {
    return `0x${BigInt(chainId).toString(16)}`;
  } catch {
    // Some wallets report the plain shortstring (e.g. 'SN_MAIN').
    return `0x${BigInt(shortString.encodeShortString(String(chainId))).toString(16)}`;
  }
}

/** Well-known Starknet chain ids (normalized hex felts). */
export const STARKNET_CHAIN_ID = {
  /** 'SN_MAIN' */
  SN_MAIN: normalizeChainId(constants.StarknetChainId.SN_MAIN),
  /** 'SN_SEPOLIA' */
  SN_SEPOLIA: normalizeChainId(constants.StarknetChainId.SN_SEPOLIA),
  /** 'KATANA' — default chain id of a local katana devnet. */
  SN_DEVNET: normalizeChainId('0x4b4154414e41'),
} as const;

/**
 * The canonical Starknet ETH ERC20 (fee token). Same address on SN_MAIN,
 * SN_SEPOLIA and katana devnets.
 */
export const ETH_ERC20_ADDRESS =
  '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7';

// ---------------------------------------------------------------------------
// Per-chain contract registry
// ---------------------------------------------------------------------------

// Define the chain ID type
export const CHAIN_ID = {
  STARKNET: 'STARKNET',
  SEPOLIA: 'SEPOLIA',
  DEVNET: 'DEVNET',
  // TODO(starknet-port, phase 6): legacy EVM networks kept only so the
  // not-yet-ported components/services (EVM contract call sites) still
  // compile. Remove together with those call sites.
  YOMINET: 'YOMINET',
  ETHEREUM: 'ETHEREUM',
} as const;

// Create a type from the values of CHAIN_ID
export type ChainIdType = typeof CHAIN_ID[keyof typeof CHAIN_ID];

// Define the contract addresses interface
interface ContractAddressesType {
  PAIR_FACTORY_V2_HOOKS?: string;
  PAIR_FACTORY_V2?: string;
  PAIR_FACTORY?: string;
  LINEAR_CURVE_V2?: string;
  EXPONENTIAL_CURVE_V2?: string;
  XYK_CURVE_V2?: string;
  GDA_CURVE_V2?: string;
  VERY_FAST_ROUTER_V2?: string;
  MULTICALL?: string;
  LISTING_BOOK?: string;
  KAMI?: string;
}

// Define the contract addresses record type
export type ContractAddressesRecord = Record<ChainIdType, ContractAddressesType>;

// Export the contract addresses with proper typing
export const CONTRACT_ADDRESSES: ContractAddressesRecord = {
  // TODO(starknet-port, phase 6): fill in once the lssvm2-starknet contracts
  // (factory, curves, router, listing book) are declared/deployed.
  [CHAIN_ID.STARKNET]: {},
  [CHAIN_ID.SEPOLIA]: {},
  [CHAIN_ID.DEVNET]: {},
  // TODO(starknet-port, phase 6): legacy EVM deployments, remove with the
  // EVM call sites.
  [CHAIN_ID.YOMINET]: {
    PAIR_FACTORY_V2_HOOKS: '0x470C73Ed96D0b6DB8F152827510bffE2a69BA538',
    LINEAR_CURVE_V2: '0x3F33C248CEB275cbBB93adB138A32C76d9060D99',
    EXPONENTIAL_CURVE_V2: '0x6c4BBEC8E3544D4A58B3E2487CfA4097Ded19eDc',
    XYK_CURVE_V2: '0x38BA53D83dE7234A04E6F0ec5Fb779681e3940cf',
    GDA_CURVE_V2: '0x53f0E31E2B8084ce4dD5991EcF157B181fc38bC1',
    VERY_FAST_ROUTER_V2: '0x1A72CB0Ab23aaF24472855EF30b5714A1a87046B',
    MULTICALL: '0x14521bbB801ac766568d7CE82cFB2968b98B4Ca3',
    LISTING_BOOK: '0x048000C86B685e6eB69f6FcB0B1a5e7E5C80b130',
    KAMI: '0x5d4376b62fa8ac16dfabe6a9861e11c33a48c677'
  },
  [CHAIN_ID.ETHEREUM]: {
    // Used to detect pair variant when looking up a pool by address.
    PAIR_FACTORY_V2: '0xA020d57aB0448Ef74115c112D18a9C231CC86000',
    PAIR_FACTORY: '0xb16c1342E617A5B6E4b631EB114483FDB289c0A4'
  }
};

// Normalized Starknet chain id (hex felt string) -> CHAIN_ID label.
// TODO(starknet-port, phase 6): rename to CHAIN_ID_BY_CHAIN_ID — the name is
// kept (chain ids used to be EVM numbers) to avoid touching the not-yet-ported
// components that index into it.
export const CHAIN_ID_BY_NUMBER: Record<string, ChainIdType> = {
  [STARKNET_CHAIN_ID.SN_MAIN]: CHAIN_ID.STARKNET,
  [STARKNET_CHAIN_ID.SN_SEPOLIA]: CHAIN_ID.SEPOLIA,
  [STARKNET_CHAIN_ID.SN_DEVNET]: CHAIN_ID.DEVNET,
};

// URL slug (lowercased label segment) -> CHAIN_ID.
export const CHAIN_ID_BY_LABEL: Record<string, ChainIdType> = {
  starknet: CHAIN_ID.STARKNET,
  mainnet: CHAIN_ID.STARKNET,
  sepolia: CHAIN_ID.SEPOLIA,
  devnet: CHAIN_ID.DEVNET,
  katana: CHAIN_ID.DEVNET,
  // TODO(starknet-port, phase 6): legacy EVM slugs, remove with the EVM
  // call sites.
  yominet: CHAIN_ID.YOMINET,
  ethereum: CHAIN_ID.ETHEREUM,
  eth: CHAIN_ID.ETHEREUM,
};
