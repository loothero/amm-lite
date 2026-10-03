import { assessGdaTradePool, assertGdaTradePoolAllowed, GdaPoolParams } from './gda-safety';

const GDA = '0x123';
const LINEAR = '0x456';
const params = (overrides: Partial<GdaPoolParams> = {}): GdaPoolParams => ({
  curveAddress: GDA, gdaCurveAddress: GDA, poolType: 2, ...overrides,
});

describe('GDA one-sided policy', () => {
  it('prohibits all GDA TRADE creation and warns on legacy pools', () => {
    const assessment = assessGdaTradePool(params());
    expect(assessment.applies).toBeTrue();
    expect(assessment.unsafe).toBeTrue();
    expect(assessment.message).toContain('No trade fee is a universal protection');
    expect(() => assertGdaTradePoolAllowed(params())).toThrowError(/prohibited at every fee/);
  });

  it('supports both one-sided GDA auctions', () => {
    for (const poolType of [0, 1]) {
      expect(assessGdaTradePool(params({ poolType })).unsafe).toBeFalse();
      expect(() => assertGdaTradePoolAllowed(params({ poolType }))).not.toThrow();
    }
  });

  it('preserves other curves and compares addresses numerically', () => {
    expect(assessGdaTradePool(params({ curveAddress: LINEAR })).unsafe).toBeFalse();
    expect(() => assertGdaTradePoolAllowed(params({ curveAddress: LINEAR }))).not.toThrow();
    expect(assessGdaTradePool(params({ curveAddress: '0x000123', gdaCurveAddress: '0X123' })).applies).toBeTrue();
  });

  it('warns and refuses TRADE creation when identification is unavailable', () => {
    for (const overrides of [
      { gdaCurveAddress: '' }, { curveAddress: '' },
      { gdaCurveAddress: 'invalid' }, { curveAddress: '0x0' },
    ]) {
      const assessment = assessGdaTradePool(params(overrides));
      expect(assessment.applies).toBeFalse();
      expect(assessment.unsafe).toBeTrue();
      expect(assessment.message).toContain('has not been verified');
      expect(() => assertGdaTradePoolAllowed(params(overrides))).toThrowError(/metadata/);
    }
  });

  it('does not require GDA metadata for one-sided creation', () => {
    expect(() => assertGdaTradePoolAllowed(params({ poolType: 1, gdaCurveAddress: '' }))).not.toThrow();
  });
});
