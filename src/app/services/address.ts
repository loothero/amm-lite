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
 * digits (66 chars). Accepts hex strings and bigints (starknet.js parses
 * ContractAddress read results as bigint). Throws on non-hex input or
 * out-of-range felts.
 */
export function normalizeAddress(address: string | bigint): string {
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
  LISTING_BOOK?: string;
  KAMI?: string;
  /** The ERC20 this chain treats as "ETH" (the Starknet fee token). */
  ETH_TOKEN?: string;
}

// Define the contract addresses record type
export type ContractAddressesRecord = Record<ChainIdType, ContractAddressesType>;

// Export the contract addresses with proper typing.
// lssvm2-starknet addresses on public networks are unset until deployed
// there; the DEVNET entry is populated at runtime from the deployments file
// (see deployments.ts) and stays a placeholder when the file is absent.
export const CONTRACT_ADDRESSES: ContractAddressesRecord = {
  [CHAIN_ID.STARKNET]: { ETH_TOKEN: ETH_ERC20_ADDRESS },
  [CHAIN_ID.SEPOLIA]: { ETH_TOKEN: ETH_ERC20_ADDRESS },
  [CHAIN_ID.DEVNET]: { ETH_TOKEN: ETH_ERC20_ADDRESS },
};

// Normalized Starknet chain id (hex felt string) -> CHAIN_ID label.
// (Name kept from the EVM era, when chain ids were numbers, to minimize
// call-site churn.)
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
};
