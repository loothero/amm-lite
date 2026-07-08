/**
 * Format a fixed-point integer amount as a decimal string (viem-style
 * `formatUnits` replacement: trailing zeros trimmed, no grouping).
 */
export function formatUnits(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = abs / base;
  const frac = abs % base;
  const sign = negative ? '-' : '';
  if (frac === 0n) return `${sign}${whole.toString()}`;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${sign}${whole.toString()}.${fracStr}`;
}

export function formatTokenAmount(amount: bigint | null, decimals: number = 18): string {
  if (amount === null || amount === undefined) return '—';
  try {
    const num = parseFloat(formatUnits(amount, decimals));
    if (num === 0) return '0';
    if (num < 0.000001) return num.toExponential(2);
    if (num < 0.001) return num.toFixed(6);
    if (num < 1) return num.toFixed(4);
    return num.toFixed(4);
  } catch {
    return '—';
  }
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr || addr.length < 12) return addr ?? '';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
