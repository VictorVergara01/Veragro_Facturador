export default function TablaLineas({ lineas, descuento = 0 }) {
  return (
    <table className="w-full text-sm mb-4">
      <thead>
        <tr className="border-b-2 border-black">
          <th className="text-left py-2 text-xs uppercase tracking-wider w-8">#</th>
          <th className="text-left py-2 text-xs uppercase tracking-wider">Descripción / Servicio</th>
          <th className="text-right py-2 text-xs uppercase tracking-wider w-14">Cant.</th>
          <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Precio Unit.</th>
          {descuento > 0 && (
            <th className="text-right py-2 text-xs uppercase tracking-wider w-16">Desc.</th>
          )}
          <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Total</th>
        </tr>
      </thead>
      <tbody>
        {lineas.map((l, i) => (
          <tr key={i} className="border-b border-gray-100">
            <td className="py-1.5 text-gray-500">{i + 1}</td>
            <td className="py-1.5">{l.descripcion}</td>
            <td className="py-1.5 text-right">{l.cantidad}</td>
            <td className="py-1.5 text-right">${Number(l.precio).toFixed(2)}</td>
            {descuento > 0 && (
              <td className="py-1.5 text-right text-gray-500">{descuento}%</td>
            )}
            <td className="py-1.5 text-right font-medium">
              ${(l.cantidad * l.precio).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
