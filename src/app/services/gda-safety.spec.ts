import {
  GDA_ALPHA_SCALE,
  assertGdaTradePoolSafe,
  assessGdaTradePool,
  formatFeePercent,
  modelGdaTradeFee,
  recommendedGdaTradeFee,
  unpackGdaAlphaRaw,
} from './gda-safety';

const GDA = '0x0199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
const LINEAR = '0x011984bda4c813337408017c8a19e5f0885207a2276a83617897053cd3be7b8a';

const POOL_TYPE_TOKEN = 0;
const POOL_TYPE_NFT = 1;
const POOL_TYPE_TRADE = 2;

/** Packs a GDA delta the way GDACurve reads it: alpha<<88 | lambda<<48 | t. */
function packDelta(alphaRaw: bigint, lambdaRaw = 0n, prevTime = 0n): bigint {
  return (alphaRaw << 88n) | (lambdaRaw << 48n) | prevTime;
}

function params(over: Partial<Parameters<typeof assessGdaTradePool>[0]> = {}) {
  return {
    curveAddress: GDA,
    gdaCurveAddress: GDA,
    poolType: POOL_TYPE_TRADE,
    delta: packDelta(1_100_000_000n),
    fee: 0n,
    ...over,
  };
}

describe('gda-safety', () => {
  describe('unpackGdaAlphaRaw', () => {
    it('reads alpha out of bits 88..127', () => {
      expect(unpackGdaAlphaRaw(packDelta(1_100_000_000n))).toBe(1_100_000_000n);
    });

    it('ignores lambda and prev_time in the low bits', () => {
      const delta = packDelta(1_020_000_000n, 12_345n, 1_700_000_000n);
      expect(unpackGdaAlphaRaw(delta)).toBe(1_020_000_000n);
    });

    it('reads alpha = 1 (the boundary validate_delta rejects)', () => {
      expect(unpackGdaAlphaRaw(packDelta(GDA_ALPHA_SCALE))).toBe(GDA_ALPHA_SCALE);
    });
  });

  describe('modelGdaTradeFee matches the port measurements', () => {
    // Expected values are (alpha-1)/(2*alpha) in 1e18 base, alongside the
    // figure bisected in packages/testing/tests/
    // test_gda_no_arb_characterisation.cairo. The model must stay within a few
    // percent of the measurement, and the safety margin must cover the gap.
    const CASES: Array<{ alphaRaw: bigint; measured: bigint }> = [
      { alphaRaw: 1_001_000_000n, measured: 449_725_137_431_285n },
      { alphaRaw: 1_010_000_000n, measured: 4_924_875_621_890_598n },
      { alphaRaw: 1_020_000_000n, measured: 9_850_495_049_504_975n },
      { alphaRaw: 1_050_000_000n, measured: 24_339_024_390_243_903n },
      { alphaRaw: 1_100_000_000n, measured: 47_566_666_666_666_668n },
      { alphaRaw: 1_500_000_000n, measured: 194_000_000_000_000_100n },
      { alphaRaw: 2_000_000_000n, measured: 326_666_666_666_666_700n },
    ];

    for (const { alphaRaw, measured } of CASES) {
      const alpha = Number(alphaRaw) / 1e9;

      it(`model is within 35% below the measurement at alpha ${alpha}`, () => {
        const model = modelGdaTradeFee(alphaRaw);
        // The model under-estimates as alpha grows; bound how far.
        expect(Number(model) / Number(measured)).toBeGreaterThan(0.7);
        expect(Number(model) / Number(measured)).toBeLessThan(1.2);
      });

      it(`recommended fee is >= the bisected measurement at alpha ${alpha}`, () => {
        // This is the property that matters: the guard must never bless a fee
        // the port proved insufficient. Jasmine's numeric matchers are typed
        // number-only, so compare bigints as booleans.
        const rec = recommendedGdaTradeFee(alphaRaw);
        expect(rec >= measured)
          .withContext(`recommended ${rec} < measured ${measured}`)
          .toBeTrue();
      });
    }
  });

  describe('recommendedGdaTradeFee', () => {
    it('is zero for alpha <= 1 (not admitted by validate_delta)', () => {
      expect(recommendedGdaTradeFee(GDA_ALPHA_SCALE)).toBe(0n);
      expect(recommendedGdaTradeFee(0n)).toBe(0n);
    });

    it('increases monotonically with alpha', () => {
      let prev = 0n;
      for (const a of [1_001_000_000n, 1_010_000_000n, 1_100_000_000n, 2_000_000_000n]) {
        const cur = recommendedGdaTradeFee(a);
        expect(cur > prev).withContext(`alpha ${a}: ${cur} !> ${prev}`).toBeTrue();
        prev = cur;
      }
    });
  });

  describe('assessGdaTradePool', () => {
    it('flags a zero-fee GDA TRADE pool as unsafe', () => {
      const a = assessGdaTradePool(params({ fee: 0n }));
      expect(a.applies).toBeTrue();
      expect(a.unsafe).toBeTrue();
      expect(a.alpha).toBeCloseTo(1.1, 9);
      expect(a.message).toContain('can be drained');
    });

    it('clears a GDA TRADE pool whose fee exceeds the recommendation', () => {
      const fee = recommendedGdaTradeFee(1_100_000_000n);
      const a = assessGdaTradePool(params({ fee }));
      expect(a.applies).toBeTrue();
      expect(a.unsafe).toBeFalse();
    });

    it('flags a fee one wei under the recommendation', () => {
      const fee = recommendedGdaTradeFee(1_100_000_000n) - 1n;
      expect(assessGdaTradePool(params({ fee })).unsafe).toBeTrue();
    });

    it('does not apply to one-sided GDA pools -- the hazard is TRADE only', () => {
      expect(assessGdaTradePool(params({ poolType: POOL_TYPE_NFT })).applies).toBeFalse();
      expect(assessGdaTradePool(params({ poolType: POOL_TYPE_TOKEN })).applies).toBeFalse();
    });

    it('does not apply to a non-GDA curve', () => {
      expect(assessGdaTradePool(params({ curveAddress: LINEAR })).applies).toBeFalse();
    });

    it('matches curve addresses numerically despite zero padding', () => {
      const padded = '0x00199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
      const stripped = '0x199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
      expect(
        assessGdaTradePool(params({ curveAddress: stripped, gdaCurveAddress: padded })).applies,
      ).toBeTrue();
    });

    it('claims nothing when the GDA address is unknown', () => {
      // Deployments not loaded: better to miss a warning than to show one
      // against a Linear pool.
      expect(assessGdaTradePool(params({ gdaCurveAddress: '' })).applies).toBeFalse();
    });

    it('claims nothing on an unparseable address', () => {
      expect(assessGdaTradePool(params({ curveAddress: 'not-an-address' })).applies).toBeFalse();
    });
  });

  describe('assertGdaTradePoolSafe', () => {
    it('throws for an under-fee\'d GDA TRADE pool', () => {
      expect(() => assertGdaTradePoolSafe(params({ fee: 0n }))).toThrowError(/Refusing to create/);
    });

    it('names the required fee and the safe alternatives', () => {
      try {
        assertGdaTradePoolSafe(params({ fee: 0n }));
        fail('expected a throw');
      } catch (e) {
        const m = (e as Error).message;
        expect(m).toContain('at least');
        expect(m).toContain('NFT or TOKEN');
      }
    });

    it('permits a sufficiently fee\'d GDA TRADE pool', () => {
      const fee = recommendedGdaTradeFee(1_100_000_000n);
      expect(() => assertGdaTradePoolSafe(params({ fee }))).not.toThrow();
    });

    it('permits everything the app creates today (Linear, NFT, fee 0)', () => {
      expect(() =>
        assertGdaTradePoolSafe(
          params({ curveAddress: LINEAR, poolType: POOL_TYPE_NFT, delta: 0n, fee: 0n }),
        ),
      ).not.toThrow();
    });
  });

  describe('formatFeePercent', () => {
    it('renders 1e18-base fees as percentages', () => {
      expect(formatFeePercent(0n)).toBe('0.0000%');
      expect(formatFeePercent(47_566_666_666_666_668n)).toBe('4.7567%');
      expect(formatFeePercent(10_000_000_000_000_000n)).toBe('1.0000%');
    });
  });
});
