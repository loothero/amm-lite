// GDA is supported only for one-sided NFT/TOKEN auctions. Its unchanged
// pricing permits profitable TRADE round trips; fees do not provide universal
// protection when time decay is involved. The factory enforces the creation
// policy for classified addresses. This guard also covers older deployments.

export const POOL_TYPE_TRADE = 2;

export interface GdaPoolParams {
  curveAddress: string;
  /** Empty means this chain's deployment metadata is unavailable. */
  gdaCurveAddress: string;
  /** TOKEN=0, NFT=1, TRADE=2. */
  poolType: number;
}

export interface GdaAssessment {
  /** True only for an identified GDA TRADE pool. */
  applies: boolean;
  /** Also true when a TRADE pool's curve cannot be identified. */
  unsafe: boolean;
  message: string;
}

export function assessGdaTradePool(params: GdaPoolParams): GdaAssessment {
  const none = { applies: false, unsafe: false, message: '' };
  if (params.poolType !== POOL_TYPE_TRADE) return none;

  let curve: bigint;
  let gda: bigint;
  try {
    if (!params.curveAddress.trim() || !params.gdaCurveAddress.trim()) throw new Error();
    curve = BigInt(params.curveAddress);
    gda = BigInt(params.gdaCurveAddress);
    if (curve <= 0n || gda <= 0n) throw new Error();
  } catch {
    return {
      applies: false,
      unsafe: true,
      message: 'The curve for this TRADE pool cannot be identified with the available ' +
        'deployment data. Its GDA risk has not been verified.',
    };
  }
  if (curve !== gda) return none;
  return {
    applies: true,
    unsafe: true,
    message: 'This GDA TRADE pool can lose funds through profitable round trips. ' +
      'No trade fee is a universal protection against its time decay. New GDA ' +
      'TRADE pools are prohibited; use a one-sided NFT or TOKEN auction, or another curve.',
  };
}

/** Validate again immediately before constructing any creation transaction. */
export function assertGdaTradePoolAllowed(params: GdaPoolParams): void {
  const assessment = assessGdaTradePool(params);
  if (!assessment.unsafe) return;
  throw new Error(assessment.applies
    ? 'GDA TRADE pools are prohibited at every fee. Choose pool type NFT or TOKEN, or another curve.'
    : 'Cannot create a TRADE pool until its curve and GDA deployment metadata are available.');
}
