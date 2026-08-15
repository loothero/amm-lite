import {
  GDA_ALPHA_SCALE,
  assertGdaTradePoolSafe,
  assessGdaTradePool,
  MAX_TRADE_FEE,
  formatFeePercent,
  gdaTradePoolIsDefensible,
  recommendedGdaTradeFee,
  unpackGdaAlphaRaw,
} from './gda-safety';

const GDA =
  '0x0199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
const LINEAR =
  '0x011984bda4c813337408017c8a19e5f0885207a2276a83617897053cd3be7b8a';

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
      expect(unpackGdaAlphaRaw(packDelta(GDA_ALPHA_SCALE))).toBe(
        GDA_ALPHA_SCALE,
      );
    });
  });

  /** The port's round-trip arbitrage tolerance, `MAX_ALLOWABLE_DIFF` (1e14 wei). */
  const MAX_ALLOWABLE_DIFF = 100_000_000_000_000n;

  // Every point the port bisected, at 1-ether notional, one item. Extending
  // this list past alpha 2.00 is what surfaced the formula error: the old
  // `>= measured` assertion below was correct and passed, but the table it ran
  // against stopped at 2.00, and the divergence only bites above ~2.08. Any
  // future measurement belongs here.
  const MEASURED: Array<{ alphaRaw: bigint; measured: bigint }> = [
    { alphaRaw: 1_001_000_000n, measured: 449_725_137_431_285n },
    { alphaRaw: 1_010_000_000n, measured: 4_924_875_621_890_598n },
    { alphaRaw: 1_020_000_000n, measured: 9_850_495_049_504_975n },
    { alphaRaw: 1_050_000_000n, measured: 24_339_024_390_243_903n },
    { alphaRaw: 1_100_000_000n, measured: 47_566_666_666_666_668n },
    { alphaRaw: 1_500_000_000n, measured: 199_940_000_000_000_001n },
    { alphaRaw: 2_000_000_000n, measured: 333_266_666_666_666_667n },
    { alphaRaw: 2_500_000_000n, measured: 428_500_000_000_000_000n },
    { alphaRaw: 3_000_000_000n, measured: 499_925_000_000_000_001n },
  ];

  describe('recommendedGdaTradeFee vs the port measurements', () => {
    for (const { alphaRaw, measured } of MEASURED) {
      const alpha = Number(alphaRaw) / 1e9;

      it(`is >= the bisected measurement at alpha ${alpha}`, () => {
        // The property that matters: never bless a fee the port proved
        // insufficient. Jasmine's numeric matchers are typed number-only, so
        // compare bigints as booleans.
        const rec = recommendedGdaTradeFee(alphaRaw);
        expect(rec >= measured)
          .withContext(`recommended ${rec} < measured ${measured}`)
          .toBeTrue();
      });

      it(`overshoots by less than the 1e14 tolerance at alpha ${alpha}`, () => {
        // The gap between the closed form and the bisected point is the port's
        // MAX_ALLOWABLE_DIFF (1e14 wei) -- the bisection stops when profit
        // drops under it, not under zero -- so it is an ABSOLUTE quantity, not
        // a proportional one. It is ~11% of the threshold at alpha 1.001 and
        // ~0.015% at alpha 3.00, which is why the bound is stated in wei.
        // Keeping it tight is what would reject a wrong-but-conservative
        // formula, the failure mode the x1.35 margin used to hide.
        const rec = recommendedGdaTradeFee(alphaRaw);
        expect(rec - measured < MAX_ALLOWABLE_DIFF)
          .withContext(`overshoot ${rec - measured} >= ${MAX_ALLOWABLE_DIFF}`)
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
      for (const a of [
        1_001_000_000n,
        1_010_000_000n,
        1_100_000_000n,
        2_000_000_000n,
      ]) {
        const cur = recommendedGdaTradeFee(a);
        expect(cur > prev)
          .withContext(`alpha ${a}: ${cur} !> ${prev}`)
          .toBeTrue();
        prev = cur;
      }
    });

    it('rounds up, never down', () => {
      // alpha 1.10: 1e26/2.1e9 = 47619047619047619.047..., so the exact value
      // is not representable and flooring would put the floor one wei low.
      expect(recommendedGdaTradeFee(1_100_000_000n)).toBe(
        47_619_047_619_047_620n,
      );
    });
  });

  describe('the alpha = 3 cliff', () => {
    it('is exactly MAX_TRADE_FEE at alpha 3', () => {
      expect(recommendedGdaTradeFee(3_000_000_000n)).toBe(MAX_TRADE_FEE);
      expect(gdaTradePoolIsDefensible(3_000_000_000n)).toBeTrue();
    });

    it('exceeds MAX_TRADE_FEE one milli-alpha past it', () => {
      expect(recommendedGdaTradeFee(3_001_000_000n) > MAX_TRADE_FEE).toBeTrue();
      expect(gdaTradePoolIsDefensible(3_001_000_000n)).toBeFalse();
    });

    it('leaves most of the admissible alpha range undefendable', () => {
      // validate_delta only requires alpha > 1; it admits alpha to ~1099.
      for (const a of [3_500_000_000n, 10_000_000_000n, 1_000_000_000_000n]) {
        expect(gdaTradePoolIsDefensible(a))
          .withContext(`alpha ${a}`)
          .toBeFalse();
      }
    });

    it('flags an undefendable pool as unsafe at the maximum settable fee', () => {
      const a = assessGdaTradePool(
        params({ delta: packDelta(3_500_000_000n), fee: MAX_TRADE_FEE }),
      );
      expect(a.applies).toBeTrue();
      expect(a.defensible).toBeFalse();
      expect(a.unsafe).toBeTrue();
      expect(a.message).toContain('NO trade fee');
      expect(a.message).toContain('raising the fee will not stop it');
    });

    it("clears a defensible pool fee'd at exactly the requirement", () => {
      const a = assessGdaTradePool(
        params({
          delta: packDelta(2_500_000_000n),
          fee: recommendedGdaTradeFee(2_500_000_000n),
        }),
      );
      expect(a.defensible).toBeTrue();
      expect(a.unsafe).toBeFalse();
    });

    it('refuses to create an undefendable pool, and says why', () => {
      try {
        assertGdaTradePoolSafe(
          params({ delta: packDelta(3_500_000_000n), fee: MAX_TRADE_FEE }),
        );
        fail('expected a throw');
      } catch (e) {
        const m = (e as Error).message;
        expect(m).toContain('cannot be protected by any trade fee');
        expect(m).toContain('alpha of 3 or less');
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
      expect(
        assessGdaTradePool(params({ poolType: POOL_TYPE_NFT })).applies,
      ).toBeFalse();
      expect(
        assessGdaTradePool(params({ poolType: POOL_TYPE_TOKEN })).applies,
      ).toBeFalse();
    });

    it('does not apply to a non-GDA curve', () => {
      expect(
        assessGdaTradePool(params({ curveAddress: LINEAR })).applies,
      ).toBeFalse();
    });

    it('matches curve addresses numerically despite zero padding', () => {
      const padded =
        '0x00199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
      const stripped =
        '0x199632449c4d5ec21f9c716789ce45b7759437384266a66af9aced3682faa96';
      expect(
        assessGdaTradePool(
          params({ curveAddress: stripped, gdaCurveAddress: padded }),
        ).applies,
      ).toBeTrue();
    });

    it('claims nothing when the GDA address is unknown', () => {
      // Deployments not loaded: better to miss a warning than to show one
      // against a Linear pool.
      expect(
        assessGdaTradePool(params({ gdaCurveAddress: '' })).applies,
      ).toBeFalse();
    });

    it('claims nothing on an unparseable address', () => {
      expect(
        assessGdaTradePool(params({ curveAddress: 'not-an-address' })).applies,
      ).toBeFalse();
    });
  });

  describe('assertGdaTradePoolSafe', () => {
    it("throws for an under-fee'd GDA TRADE pool", () => {
      expect(() => assertGdaTradePoolSafe(params({ fee: 0n }))).toThrowError(
        /Refusing to create/,
      );
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

    it("permits a sufficiently fee'd GDA TRADE pool", () => {
      const fee = recommendedGdaTradeFee(1_100_000_000n);
      expect(() => assertGdaTradePoolSafe(params({ fee }))).not.toThrow();
    });

    it('permits everything the app creates today (Linear, NFT, fee 0)', () => {
      expect(() =>
        assertGdaTradePoolSafe(
          params({
            curveAddress: LINEAR,
            poolType: POOL_TYPE_NFT,
            delta: 0n,
            fee: 0n,
          }),
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
