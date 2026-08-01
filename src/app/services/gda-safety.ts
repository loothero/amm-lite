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
//   alpha | measured min fee | as %    | (alpha-1)/(2*alpha)
//   ------|------------------|---------|--------------------
//   1.001 |    449725137431285 | 0.0450% | 0.0500%
//   1.01  |   4924875621890598 | 0.4925% | 0.4950%
//   1.02  |   9850495049504975 | 0.9850% | 0.9804%
//   1.05  |  24339024390243903 | 2.4339% | 2.3810%
//   1.10  |  47566666666666668 | 4.7567% | 4.5455%
//   1.50  | 194000000000000100 | 19.400% | 16.667%
//   2.00  | 326666666666666700 | 32.667% | 25.000%
//
// So the closed form (alpha-1)/(2*alpha) is a good approximation but it
// UNDER-estimates as alpha grows -- by 4.6% at alpha 1.10 and 30.7% at alpha
// 2.00. Under-estimating is the dangerous direction for a guard (it would bless
// an unsafe pool), so SAFETY_MARGIN_BPS below inflates the model to cover the
// worst observed divergence. Erring high only ever costs a pool creator a
// slightly larger fee than strictly necessary.

/** `alpha` occupies bits 88..127 of a GDA `delta` (u40, 9 decimals). */
const ALPHA_SHIFT = 88n;

/** alpha/lambda are scaled by 1e9 (`GDACurve _SCALE_FACTOR`). */
export const GDA_ALPHA_SCALE = 1_000_000_000n;

/** Fee multipliers are 1e18-base, like the pair's `fee()`. */
const WAD = 1_000_000_000_000_000_000n;

/**
 * Inflation applied to the closed-form threshold, in basis points.
 *
 * 13_500 = x1.35, chosen to cover the largest measured divergence between the
 * model and the bisected truth (x1.307 at alpha = 2.00) with headroom. Raise it
 * if the port's measurements are ever extended past alpha = 2.
 */
const SAFETY_MARGIN_BPS = 13_500n;

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
  /** True when `applies` and the fee is below the recommended floor. */
  unsafe: boolean;
  /** alpha as a decimal number, for display (e.g. 1.1). */
  alpha: number;
  /** Recommended minimum fee, 1e18-base (model + safety margin). */
  recommendedMinFee: bigint;
  /** The unmargined closed-form value, 1e18-base. For explanation only. */
  modelMinFee: bigint;
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
 * not round-trip arbitrageable: `(alpha - 1) / (2 * alpha)`, inflated by
 * SAFETY_MARGIN_BPS.
 *
 * Returns 0n for alpha <= 1, which `validate_delta` does not admit anyway.
 */
export function recommendedGdaTradeFee(alphaRaw: bigint): bigint {
  if (alphaRaw <= GDA_ALPHA_SCALE) return 0n;
  const model = ((alphaRaw - GDA_ALPHA_SCALE) * WAD) / (2n * alphaRaw);
  return (model * SAFETY_MARGIN_BPS) / 10_000n;
}

/** The unmargined closed form, exposed so the UI can show both numbers. */
export function modelGdaTradeFee(alphaRaw: bigint): bigint {
  if (alphaRaw <= GDA_ALPHA_SCALE) return 0n;
  return ((alphaRaw - GDA_ALPHA_SCALE) * WAD) / (2n * alphaRaw);
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
    alpha: 0,
    recommendedMinFee: 0n,
    modelMinFee: 0n,
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
  const modelMinFee = modelGdaTradeFee(alphaRaw);
  const alpha = Number(alphaRaw) / Number(GDA_ALPHA_SCALE);
  const unsafe = params.fee < recommendedMinFee;

  return {
    applies: true,
    unsafe,
    alpha,
    recommendedMinFee,
    modelMinFee,
    message: unsafe
      ? `This is a GDA pool of type TRADE with alpha ${alpha}. GDA has no bid/ask ` +
        `spread, so anyone can buy and immediately sell back for a profit paid out ` +
        `of this pool. Its trade fee is ${formatFeePercent(params.fee)}, below the ` +
        `${formatFeePercent(recommendedMinFee)} needed to make that unprofitable. ` +
        `Funds in this pool can be drained.`
      : `GDA TRADE pool with alpha ${alpha}. Its trade fee of ` +
        `${formatFeePercent(params.fee)} is at or above the ` +
        `${formatFeePercent(recommendedMinFee)} needed to prevent round-trip ` +
        `arbitrage.`,
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
  if (a.applies && a.unsafe) {
    throw new Error(
      `Refusing to create this pool: a GDA TRADE pool with alpha ${a.alpha} needs a ` +
        `trade fee of at least ${formatFeePercent(a.recommendedMinFee)} or it can be ` +
        `drained by round-trip arbitrage. Either raise the fee, pick pool type NFT or ` +
        `TOKEN (one-sided GDA pools are unaffected), or choose a different curve.`,
    );
  }
}
