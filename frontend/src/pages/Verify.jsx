import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function Verify() {
  const { codigo } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/documentos')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(docs => {
        const found = docs.find(d => d.numero === decodeURIComponent(codigo));
        if (!found) throw new Error('Documento no encontrado');
        return fetch(`/api/documentos/${found.id}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
      })
      .then(setDoc)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono bg-white px-4">
        <p className="text-gray-400 text-sm tracking-widest">Verificando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono bg-white px-4">
        <div className="text-center">
          <div className="text-5xl mb-4 text-gray-300">✕</div>
          <p className="font-bold text-red-600 mb-1">Documento no encontrado</p>
          <p className="text-xs text-gray-400">{decodeURIComponent(codigo)}</p>
        </div>
      </div>
    );
  }

  const subtotal = doc.lineas.reduce((s, l) => {
    const d = l.descuento ?? 0;
    return s + l.cantidad * l.precio * (1 - d / 100);
  }, 0);

  return (
    <div className="min-h-screen bg-white font-mono">
      <div className="max-w-sm mx-auto px-4 py-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-2xl font-bold">
            <span>AGRO</span>
            <span style={{ color: '#c8f060' }}>TECH</span>
          </div>
          <div className="text-xs tracking-[0.4em] text-gray-400 mt-0.5">DRONES</div>
        </div>

        {/* Verification badge */}
        <div className="border-2 border-black p-5 mb-6 text-center">
          <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">
            Documento verificado ✓
          </div>
          <div className="text-xl font-bold mb-1" style={{ color: '#c8371a' }}>
            {doc.tipoLabel}
          </div>
          <div className="text-2xl font-bold">{doc.numero}</div>
        </div>

        {/* Details */}
        <div className="space-y-4 mb-8">
          {[
            { label: 'Cliente', value: doc.cliente },
            { label: 'RUC', value: doc.ruc || '—' },
            { label: 'Fecha de Emisión', value: doc.fecha || '—' },
            { label: 'Estado', value: doc.estado || '—' },
            { label: 'Monto', value: `$${subtotal.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between text-sm border-b border-gray-100 pb-2">
              <span className="text-xs uppercase tracking-wider text-gray-400">{label}</span>
              <span className="font-medium text-right">{value}</span>
            </div>
          ))}
        </div>

        {doc.lineas.length > 0 && (
          <div className="mb-8">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">Servicios</div>
            {doc.lineas.map((l, i) => (
              <div key={i} className="flex justify-between text-xs py-1 border-b border-gray-50">
                <span className="text-gray-700">{l.descripcion}</span>
                <span>${(l.cantidad * l.precio * (1 - (l.descuento ?? 0) / 100)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-300 text-center">
          AgroTech Drones — Documento autenticado
        </p>
      </div>
    </div>
  );
}
