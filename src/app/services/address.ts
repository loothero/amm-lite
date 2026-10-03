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
  // Verified Sepolia stack: lssvm2-cairo deployments/sepolia.json, ab57ec0.
  [CHAIN_ID.SEPOLIA]: {
    ETH_TOKEN: ETH_ERC20_ADDRESS,
    PAIR_FACTORY_V2_HOOKS: '0xb1586ba207dc981c7fa3f7dfd9cc9af05ce2d03e21cff88e845d3d8ef56d0d',
    VERY_FAST_ROUTER_V2: '0x67df68971e26e9f9e72ed7a68d8b1eb0a91bce48e52fa5232ab42bfa76f7658',
    LISTING_BOOK: '0x9556f901d78be9f46be9fe9966177ccc35c55016081c28ac08231fbb56421f',
    LINEAR_CURVE_V2: '0x36c85a7d6eddfd38af2a3d3fc8c3e2cfb4c91363b24bc0603127814f7ff06c0',
    EXPONENTIAL_CURVE_V2: '0x12709f7b2846eab2ab2de4dd9661be97c9b2732f1854b0b87a03a8c6a5ee7c4',
    XYK_CURVE_V2: '0x13e9d7ccfa2d02528f635a42480790c6e2fb80c8fa9d665267227c2998606c8',
    GDA_CURVE_V2: '0xe970020508a740404a79385e5b10ba79a9dbabf3051668d509a33c5d925bfa',
  },
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
