// Shared helpers for the starknet.js contract layer: Cairo enum decoding,
// u256 calldata building, and quote-struct parsing.

import { CairoCustomEnum, uint256 } from 'starknet';

// ---------------------------------------------------------------------------
// Cairo enum decoding
// ---------------------------------------------------------------------------

/** `lssvm_interfaces::types::PoolType` variant order (wire values 0/1/2). */
export const POOL_TYPE_VARIANTS = ['TOKEN', 'NFT', 'TRADE'] as const;

/** `lssvm_interfaces::types::CurveError` variant order (0 = OK). */
export const CURVE_ERROR_VARIANTS = [
  'OK',
  'INVALID_NUMITEMS',
  'SPOT_PRICE_OVERFLOW',
  'DELTA_OVERFLOW',
  'SPOT_PRICE_UNDERFLOW',
  'AUCTION_ENDED',
] as const;

/** Wire index of a unit-variant Cairo enum decoded by starknet.js. */
function enumIndex(value: CairoCustomEnum, variants: readonly string[]): number {
  const idx = variants.indexOf(value.activeVariant());
  return idx >= 0 ? idx : -1;
}

/** PoolType enum -> numeric wire value: TOKEN=0, NFT=1, TRADE=2. */
export function decodePoolType(value: CairoCustomEnum): number {
  return enumIndex(value, POOL_TYPE_VARIANTS);
}

/** CurveError enum -> numeric wire value; 0 means OK. */
export function decodeCurveError(value: CairoCustomEnum): number {
  return enumIndex(value, CURVE_ERROR_VARIANTS);
}

// ---------------------------------------------------------------------------
// NFTQuote parsing
// ---------------------------------------------------------------------------

/**
 * Parsed `lssvm_interfaces::types::NFTQuote`. Field order on the wire is
 * `(error, new_spot_price, new_delta, amount, protocol_fee, royalty_amount)`;
 * we read the struct FIELDS (never tuple indexes). `error != 0` means the
 * quote is unavailable.
 */
export interface NftQuote {
  error: number;
  errorName: string;
  newSpotPrice: bigint;
  newDelta: bigint;
  amount: bigint;
  protocolFee: bigint;
  royaltyAmount: bigint;
}

export function parseNftQuote(raw: any): NftQuote {
  const error = decodeCurveError(raw.error as CairoCustomEnum);
  return {
    error,
    errorName: (raw.error as CairoCustomEnum).activeVariant(),
    newSpotPrice: BigInt(raw.new_spot_price),
    newDelta: BigInt(raw.new_delta),
    amount: BigInt(raw.amount),
    protocolFee: BigInt(raw.protocol_fee),
    royaltyAmount: BigInt(raw.royalty_amount),
  };
}

// ---------------------------------------------------------------------------
// Raw calldata builders (for `account.execute` calls)
// ---------------------------------------------------------------------------

/** Serialize a u256 as its two felt limbs `[low, high]`. */
export function u256Calldata(value: bigint): string[] {
  const { low, high } = uint256.bnToUint256(value);
  return [low.toString(), high.toString()];
}

/** Serialize an `Array<u256>` as `[len, low0, high0, low1, high1, ...]`. */
export function u256ArrayCalldata(values: readonly bigint[]): string[] {
  return [values.length.toString(), ...values.flatMap(v => u256Calldata(v))];
}

/** Serialize a Cairo bool as a single felt. */
export function boolCalldata(value: boolean): string {
  return value ? '1' : '0';
}
