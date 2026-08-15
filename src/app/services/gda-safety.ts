// GDA TRADE-pool safety rule.
//
// A GDACurve pool of type TRADE has NO bid/ask spread: at a given (spot, delta)
// the curve quotes the same amount to buy n items as it pays to sell n, and the
// price only moves AFTER the trade, by alpha^n. A same-block reversal therefore
// captures the whole move, and the round trip is profitable for EVERY alpha > 1
// that the factory admits. Whoever funded the pool pays for it.
//
// This is faithful upstream sudoswap GDACurve.sol behaviour reproduced by the
// Cairo port -- not a bug in either. GDA is built for one-sided auctions; the
// factory just doesn't stop anyone pointing it at a TRADE pool. The blast
// radius is the misconfiguring pool's own deposit: no other pool, no protocol
// funds, no third-party NFTs. It is a pool-configuration footgun.
//
// The pool IS safe once its trade fee is large enough, because a TRADE pool's
// fee accrues to the pool and a round-tripper pays it on both legs. The
// lssvm2-starknet port measured the threshold by bisection
// (packages/testing/tests/test_gda_no_arb_characterisation.cairo, the
// `gda_fee_offset_*` tests); see docs/gda-trade-pools.md there for the full
// analysis. At 1-ether notional, one item:
//
//   alpha | measured min fee   | as %    | (alpha-1)/(alpha+1)
//   ------|--------------------|---------|--------------------
//   1.001 |    449725137431285 | 0.0450% | 0.0500%
//   1.01  |   4924875621890598 | 0.4925% | 0.4975%
//   1.02  |   9850495049504975 | 0.9850% | 0.9901%
//   1.05  |  24339024390243903 | 2.4339% | 2.4390%
//   1.10  |  47566666666666668 | 4.7567% | 4.7619%
//   1.50  | 199940000000000001 | 19.994% | 20.000%
//   2.00  | 333266666666666667 | 33.327% | 33.333%
//   2.50  | 428500000000000000 | 42.850% | 42.857%
//   3.00  | 499925000000000001 | 49.993% | 50.000%
//   3.001 |  no admissible fee | ------- | 50.012%
//
// `(alpha-1)/(alpha+1)` is the exact closed form, and it is the SAFE side of
// every measurement: the bisection stops once the round-trip profit falls under
// the port's 1e14 tolerance rather than under zero, so the truth is always a
// touch below the form. No safety margin is applied or needed.
//
// CORRECTED 2026-08-15. This file previously used `(alpha-1)/(2*alpha)`
// inflated x1.35, taken from a table in the port's docs whose alpha 1.50 and
// 2.00 rows had been measured at 0.01 ether and captioned as 1-ether. That
// margin covered the formula error only to alpha ~= 2.08; past it the guard
// UNDER-stated the required fee (40.50% recommended vs 42.86% needed at alpha
// 2.50), and past alpha 3 it returned a settable-looking number for a pool that
// nothing can defend. The spec's central assertion -- recommendation >= every
// measured point -- held the whole time, because every measured point was
// <= alpha 2.00. The bug was in the domain the tests sampled, not the assertion.

/** `alpha` occupies bits 88..127 of a GDA `delta` (u40, 9 decimals). */
const ALPHA_SHIFT = 88n;

/** alpha/lambda are scaled by 1e9 (`GDACurve _SCALE_FACTOR`). */
export const GDA_ALPHA_SCALE = 1_000_000_000n;

/** Fee multipliers are 1e18-base, like the pair's `fee()`. */
const WAD = 1_000_000_000_000_000_000n;

/**
 * The largest trade fee a pair will accept: 50%, 1e18-base.
 *
 * `LSSVMPair.sol:MAX_TRADE_FEE`, enforced as `fee <= MAX_TRADE_FEE` in both the
 * initializer and `change_fee` (`packages/pair/src/pair_core.cairo:236,450`).
 *
 * This is what puts a hard ceiling on which GDA TRADE pools are defensible at
 * all: `(alpha-1)/(alpha+1) <= 1/2` iff `alpha <= 3`, while `validate_delta`
 * admits alpha up to roughly 1099. Most of the admissible alpha range CANNOT be
 * protected by any fee the pair will let you set.
 */
export const MAX_TRADE_FEE = 500_000_000_000_000_000n;

/** The largest alpha (raw, 9 decimals) for which some admissible fee works. */
export const MAX_DEFENSIBLE_ALPHA_RAW = 3n * GDA_ALPHA_SCALE;

export interface GdaPoolParams {
  /** Bonding curve the pool uses, normalized (lowercase 0x hex). */
  curveAddress: string;
  /** The GDACurve address for this chain, normalized. Empty = unknown. */
  gdaCurveAddress: string;
  /** PoolType wire value: TOKEN=0, NFT=1, TRADE=2. */
  poolType: number;
  /** Packed GDA delta. */
  delta: bigint;
  /** Pool trade fee, 1e18-base. */
  fee: bigint;
}

export interface GdaAssessment {
  /** Is this a GDACurve pool of type TRADE at all? */
  applies: boolean;
  /** True when `applies` and the fee is below the required floor. */
  unsafe: boolean;
  /**
   * False when no fee the pair accepts can protect this pool -- i.e. alpha > 3,
   * so the required fee exceeds MAX_TRADE_FEE. Such a pool is always `unsafe`.
   */
  defensible: boolean;
  /** alpha as a decimal number, for display (e.g. 1.1). */
  alpha: number;
  /**
   * Fee required to neutralise round-trip arbitrage, 1e18-base. When
   * `defensible` is false this exceeds MAX_TRADE_FEE and cannot be set.
   */
  recommendedMinFee: bigint;
  /** Human-readable summary, or '' when `applies` is false. */
  message: string;
}

/** PoolType wire value for TRADE. */
export const POOL_TYPE_TRADE = 2;

/** Unpacks `alpha` (raw, 9 decimals) from a packed GDA delta. */
export function unpackGdaAlphaRaw(delta: bigint): bigint {
  return delta >> ALPHA_SHIFT;
}

/** Formats a 1e18-base fee as a percentage string, e.g. '4.7567%'. */
export function formatFeePercent(fee: bigint): string {
  // 4 decimal places on the percentage -> scale by 1e6 relative to WAD.
  // Round rather than truncate: bigint division floors, which would render the
  // measured 4.7567% threshold as '4.7566%' and read as an off-by-one.
  const scaled = (fee * 1_000_000n + WAD / 2n) / WAD;
  return `${(Number(scaled) / 10_000).toFixed(4)}%`;
}

/**
 * Smallest trade fee (1e18-base) at which a GDA TRADE pool with this alpha is
 * not round-trip arbitrageable: exactly `(alpha - 1) / (alpha + 1)`.
 *
 * Rounded UP. Bigint division floors, and for a safety floor the only tolerable
 * rounding direction is away from zero -- a one-wei shortfall is the same class
 * of error as the 2.4-point shortfall this function used to have.
 *
 * Returns 0n for alpha <= 1, which `validate_delta` does not admit anyway. May
 * return more than MAX_TRADE_FEE (for alpha > 3), which is the signal that no
 * settable fee protects the pool -- check `gdaTradePoolIsDefensible`.
 */
export function recommendedGdaTradeFee(alphaRaw: bigint): bigint {
  if (alphaRaw <= GDA_ALPHA_SCALE) return 0n;
  const num = (alphaRaw - GDA_ALPHA_SCALE) * WAD;
  const den = alphaRaw + GDA_ALPHA_SCALE;
  return (num + den - 1n) / den;
}

/**
 * True when SOME fee the pair accepts neutralises round-trip arbitrage at this
 * alpha, i.e. `alpha <= 3`. False means the pool is undefendable at any fee and
 * the only fixes are a smaller alpha, a different pool type, or another curve.
 */
export function gdaTradePoolIsDefensible(alphaRaw: bigint): boolean {
  if (alphaRaw <= GDA_ALPHA_SCALE) return true;
  return recommendedGdaTradeFee(alphaRaw) <= MAX_TRADE_FEE;
}

/**
 * Assesses whether a pool is an under-fee'd GDA TRADE pool.
 *
 * Deliberately conservative about identification: if the GDA curve address for
 * the chain is unknown (deployments not loaded), `applies` is false and nothing
 * is claimed. A missed warning is better than one shown against a Linear pool.
 */
export function assessGdaTradePool(params: GdaPoolParams): GdaAssessment {
  const none: GdaAssessment = {
    applies: false,
    unsafe: false,
    defensible: true,
    alpha: 0,
    recommendedMinFee: 0n,
    message: '',
  };

  const gda = params.gdaCurveAddress.trim().toLowerCase();
  const curve = params.curveAddress.trim().toLowerCase();
  if (!gda || !curve) return none;
  // Compare numerically: felt addresses differ in leading-zero padding.
  let sameCurve: boolean;
  try {
    sameCurve = BigInt(curve) === BigInt(gda);
  } catch {
    return none;
  }
  if (!sameCurve) return none;
  if (params.poolType !== POOL_TYPE_TRADE) return none;

  const alphaRaw = unpackGdaAlphaRaw(params.delta);
  if (alphaRaw <= GDA_ALPHA_SCALE) return none;

  const recommendedMinFee = recommendedGdaTradeFee(alphaRaw);
  const defensible = recommendedMinFee <= MAX_TRADE_FEE;
  const alpha = Number(alphaRaw) / Number(GDA_ALPHA_SCALE);
  // An undefendable pool is unsafe whatever its fee -- the comparison already
  // says so (fee cannot exceed MAX_TRADE_FEE < recommendedMinFee), but state it
  // rather than relying on the pair having rejected an over-large fee.
  const unsafe = !defensible || params.fee < recommendedMinFee;

  const preamble =
    `This is a GDA pool of type TRADE with alpha ${alpha}. GDA has no bid/ask ` +
    `spread, so anyone can buy and immediately sell back for a profit paid out ` +
    `of this pool.`;

  let message: string;
  if (!defensible) {
    message =
      `${preamble} At alpha above 3 NO trade fee can make that unprofitable: it ` +
      `would take ${formatFeePercent(recommendedMinFee)}, and the pair caps the ` +
      `trade fee at ${formatFeePercent(MAX_TRADE_FEE)}. Funds in this pool can be ` +
      `drained and raising the fee will not stop it.`;
  } else if (unsafe) {
    message =
      `${preamble} Its trade fee is ${formatFeePercent(params.fee)}, below the ` +
      `${formatFeePercent(recommendedMinFee)} needed to make that unprofitable. ` +
      `Funds in this pool can be drained.`;
  } else {
    message =
      `GDA TRADE pool with alpha ${alpha}. Its trade fee of ` +
      `${formatFeePercent(params.fee)} is at or above the ` +
      `${formatFeePercent(recommendedMinFee)} needed to prevent round-trip ` +
      `arbitrage.`;
  }

  return {
    applies: true,
    unsafe,
    defensible,
    alpha,
    recommendedMinFee,
    message,
  };
}

/**
 * Creation guard: throws when the parameters would produce a drainable pool.
 *
 * Call this from every create-pool path before building the transaction. The
 * app currently only creates Linear NFT pools, so today this never fires -- it
 * is here so that a curve/pool-type selector cannot be added without the guard
 * already being in force.
 */
export function assertGdaTradePoolSafe(params: GdaPoolParams): void {
  const a = assessGdaTradePool(params);
  if (!a.applies || !a.unsafe) return;

  if (!a.defensible) {
    throw new Error(
      `Refusing to create this pool: a GDA TRADE pool with alpha ${a.alpha} cannot ` +
        `be protected by any trade fee. It would need ` +
        `${formatFeePercent(a.recommendedMinFee)} and the pair caps the fee at ` +
        `${formatFeePercent(MAX_TRADE_FEE)}, so the pool is drainable by round-trip ` +
        `arbitrage however it is configured. Use an alpha of 3 or less, pick pool ` +
        `type NFT or TOKEN (one-sided GDA pools are unaffected), or choose a ` +
        `different curve.`,
    );
  }

  throw new Error(
    `Refusing to create this pool: a GDA TRADE pool with alpha ${a.alpha} needs a ` +
      `trade fee of at least ${formatFeePercent(a.recommendedMinFee)} or it can be ` +
      `drained by round-trip arbitrage. Either raise the fee, pick pool type NFT or ` +
      `TOKEN (one-sided GDA pools are unaffected), or choose a different curve.`,
  );
}
