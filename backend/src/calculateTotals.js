function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyDiscountAndTax(lineas, descuento = 0, applyItbms = false) {
  const subtotalBruto = round2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
  const descuentoAmt = round2(subtotalBruto * (descuento / 100));
  const subtotal = round2(subtotalBruto - descuentoAmt);
  const itbmsAmt = applyItbms ? round2(subtotal * 0.07) : 0;
  const total = round2(subtotal + itbmsAmt);
  return { subtotalBruto, descuentoAmt, subtotal, itbmsAmt, total };
}

module.exports = { applyDiscountAndTax };
