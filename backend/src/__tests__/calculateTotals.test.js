const { applyDiscountAndTax } = require('../calculateTotals');

const lineas = [
  { cantidad: 2, precio: 100 },
  { cantidad: 1, precio: 50 },
];
// subtotalBruto = 250

describe('applyDiscountAndTax', () => {
  test('no discount, no itbms', () => {
    const r = applyDiscountAndTax(lineas, 0, false);
    expect(r.subtotalBruto).toBe(250);
    expect(r.descuentoAmt).toBe(0);
    expect(r.subtotal).toBe(250);
    expect(r.itbmsAmt).toBe(0);
    expect(r.total).toBe(250);
  });

  test('10% discount, no itbms', () => {
    const r = applyDiscountAndTax(lineas, 10, false);
    expect(r.descuentoAmt).toBe(25);
    expect(r.subtotal).toBe(225);
    expect(r.total).toBe(225);
  });

  test('no discount, with itbms 7%', () => {
    const r = applyDiscountAndTax(lineas, 0, true);
    expect(r.itbmsAmt).toBe(17.5);
    expect(r.total).toBe(267.5);
  });

  test('10% discount + itbms applied after discount', () => {
    const r = applyDiscountAndTax(lineas, 10, true);
    expect(r.subtotal).toBe(225);
    expect(r.itbmsAmt).toBe(15.75);
    expect(r.total).toBe(240.75);
  });

  test('empty lineas returns all zeros', () => {
    const r = applyDiscountAndTax([], 0, false);
    expect(r.total).toBe(0);
  });

  test('rounding: 1/3 price does not accumulate float error', () => {
    const r = applyDiscountAndTax([{ cantidad: 3, precio: 0.1 }], 0, false);
    expect(r.total).toBe(0.3);
  });
});
