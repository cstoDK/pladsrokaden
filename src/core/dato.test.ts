import { describe, expect, it } from 'vitest';
import { iDag, isoUge, kortDato, planTitel } from './dato';

describe('isoUge', () => {
  it('følger ISO 8601', () => {
    expect(isoUge('2026-10-30')).toEqual({ aar: 2026, uge: 44 });
    expect(isoUge('2021-01-03')).toEqual({ aar: 2020, uge: 53 });
    expect(isoUge('2024-12-30')).toEqual({ aar: 2025, uge: 1 });
    expect(isoUge('2026-01-01')).toEqual({ aar: 2026, uge: 1 });
  });
});

describe('formatering', () => {
  it('skriver datoer på dansk', () => {
    expect(kortDato('2026-05-03')).toBe('3. maj 2026');
    expect(planTitel('2026-10-30')).toBe('Uge 44, 30. okt. 2026');
    expect(iDag(new Date(2026, 0, 9))).toBe('2026-01-09');
  });
});
