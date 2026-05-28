function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyDiscountAndTax(lineas, descuento = 0, applyItbms = false) {
  const subtotalBruto = round2(lineas.reduce((s, l) => {
    const d = l.descuento ?? 0;
    return s + l.cantidad * l.precio * (1 - d / 100);
  }, 0));
  const descuentoAmt = round2(subtotalBruto * (descuento / 100));
  const subtotal = round2(subtotalBruto - descuentoAmt);
  const itbmsAmt = applyItbms ? round2(subtotal * 0.07) : 0;
  const total = round2(subtotal + itbmsAmt);
  return { subtotalBruto, descuentoAmt, subtotal, itbmsAmt, total };
}

module.exports = { applyDiscountAndTax };
