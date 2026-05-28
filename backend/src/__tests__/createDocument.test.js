const { computeNextNumber } = require('../notion');

describe('computeNextNumber', () => {
  test('starts at 001 when no existing docs', () => {
    expect(computeNextNumber('FAC', [])).toBe('FAC-001');
  });

  test('increments from highest number of matching type', () => {
    expect(computeNextNumber('FAC', ['FAC-001', 'FAC-003', 'SER-002'])).toBe('FAC-004');
  });

  test('ignores other types', () => {
    expect(computeNextNumber('COT', ['FAC-001', 'FAC-002'])).toBe('COT-001');
  });

  test('pads to 3 digits', () => {
    expect(computeNextNumber('SER', ['SER-009'])).toBe('SER-010');
  });

  test('handles large numbers', () => {
    expect(computeNextNumber('FAC', ['FAC-099'])).toBe('FAC-100');
  });
});
