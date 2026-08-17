import { describe, test, expect } from 'vitest';
import { formatAmount, getEscrowStateLabel } from './utils';
import { EscrowState } from './contracts/anchorpay/src/index';

describe('Frontend Utility Helpers', () => {
  // Test 1: formatAmount decimals parsing
  test('formatAmount converts Soroban integer amounts to readable XLM (7 decimals)', () => {
    // 1000 XLM is stored as 10,000,000,000 in ledger (7 decimals)
    expect(formatAmount(10000000000n)).toBe('1,000');
    expect(formatAmount(10000000)).toBe('1');
    expect(formatAmount(0)).toBe('0');
  });

  // Test 2: formatAmount type handling
  test('formatAmount handles string, number, and bigint inputs correctly', () => {
    expect(formatAmount('50000000')).toBe('5');
    expect(formatAmount(50000000n)).toBe('5');
    expect(formatAmount(12345678)).toBe('1.2345678');
  });

  // Test 3: getEscrowStateLabel mappings
  test('getEscrowStateLabel returns matching status labels and style classes', () => {
    const initLabel = getEscrowStateLabel(EscrowState.Init);
    expect(initLabel.text).toContain('Waiting for Deposit');
    expect(initLabel.color).toContain('text-blue-400');

    const depositedLabel = getEscrowStateLabel(EscrowState.Deposited);
    expect(depositedLabel.text).toContain('Active Escrow');
    expect(depositedLabel.color).toContain('text-amber-400');

    const releasedLabel = getEscrowStateLabel(EscrowState.Released);
    expect(releasedLabel.text).toContain('Completed');
    expect(releasedLabel.color).toContain('text-emerald-400');
  });
});
