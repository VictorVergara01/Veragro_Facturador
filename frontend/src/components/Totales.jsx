function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function Totales({ lineas, descuento = 0, itbms = false }) {
  const subtotalBruto = round2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
  const descuentoAmt = round2(subtotalBruto * (descuento / 100));
  const subtotal = round2(subtotalBruto - descuentoAmt);
  const itbmsAmt = itbms ? round2(subtotal * 0.07) : 0;
  const total = round2(subtotal + itbmsAmt);

  return (
    <div className="flex justify-end mb-4">
      <div className="w-64 text-sm">
        <div className="flex justify-between py-1 border-b border-gray-100">
          <span className="text-gray-600">Subtotal</span>
          <span>${subtotalBruto.toFixed(2)}</span>
        </div>
        {descuento > 0 && (
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Descuento ({descuento}%)</span>
            <span>-${descuentoAmt.toFixed(2)}</span>
          </div>
        )}
        {itbms && (
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">ITBMS (7%)</span>
            <span>${itbmsAmt.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 mt-1 border-t-2 border-black font-bold text-base">
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
