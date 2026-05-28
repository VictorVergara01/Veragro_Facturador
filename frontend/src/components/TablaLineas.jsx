export default function TablaLineas({ lineas, descuento = 0 }) {
  const hasLineDiscounts = lineas.some(l => (l.descuento ?? 0) > 0);

  return (
    <table className="w-full text-sm mb-4">
      <thead>
        <tr className="border-b-2 border-black">
          <th className="text-left py-2 text-xs uppercase tracking-wider w-28">SKU</th>
          <th className="text-left py-2 text-xs uppercase tracking-wider">Producto</th>
          <th className="text-right py-2 text-xs uppercase tracking-wider w-14">Cant.</th>
          <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Precio Unit.</th>
          {hasLineDiscounts && (
            <th className="text-right py-2 text-xs uppercase tracking-wider w-16">Desc.</th>
          )}
          <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Total</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((l, i) => {
          const lineDesc = l.descuento ?? 0;
          const lineTotal = l.cantidad * l.precio * (1 - lineDesc / 100);
          return (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1.5 text-gray-500 text-xs">{l.sku || '—'}</td>
              <td className="py-1.5">{l.descripcion}</td>
              <td className="py-1.5 text-right">{l.cantidad}</td>
              <td className="py-1.5 text-right">${Number(l.precio).toFixed(2)}</td>
              {hasLineDiscounts && (
                <td className="py-1.5 text-right text-gray-500">
                  {lineDesc > 0 ? `${lineDesc}%` : '—'}
                </td>
              )}
              <td className="py-1.5 text-right font-medium">${lineTotal.toFixed(2)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
