import { formatUnits } from 'viem';

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
