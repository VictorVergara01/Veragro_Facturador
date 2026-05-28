import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';

const TIPO_STYLE = {
  FAC: { label: 'Factura', color: '#c8371a' },
  COT: { label: 'Cotización', color: '#1a5cc8' },
  SER: { label: 'Servicio', color: '#2a7a2a' },
};

const ESTADOS = ['Borrador', 'Enviada', 'Pagada', 'Cancelada'];

const ESTADO_STYLE = {
  Borrador: 'text-gray-400',
  Enviada:  'text-blue-600',
  Pagada:   'text-green-700',
  Cancelada: 'text-red-500',
};

async function patchEstado(id, estado) {
  const resp = await fetch(`/api/documentos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });
  if (!resp.ok) throw new Error((await resp.json()).error);
}

export default function Lista() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetch('/api/documentos')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setDocs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleEstadoChange(docId, estado) {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado } : d));
    try {
      await patchEstado(docId, estado);
      showToast(`Estado: ${estado}`);
    } catch {
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, estado: d.estado } : d));
      showToast('Error al cambiar estado', 'error');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        <p className="text-gray-500 tracking-widest text-sm">Cargando documentos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8 font-mono">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-baseline gap-3 mb-10">
          <span className="text-4xl font-bold tracking-tight">AGRO</span>
          <span className="text-4xl font-bold tracking-tight" style={{ color: '#c8f060' }}>TECH</span>
          <span className="text-xs tracking-[0.4em] text-gray-400 mb-0.5">DRONES</span>
        </div>

        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Documentos — {docs.length} registros
          </h2>
          <Link
            to="/nueva"
            className="px-4 py-1.5 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            + Nueva
          </Link>
        </div>

        {docs.length === 0 ? (
          <p className="text-sm text-gray-400">No hay documentos en la base de datos de Notion.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black">
                <th className="text-left py-2 text-xs uppercase tracking-wider font-bold">Número</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider font-bold">Tipo</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider font-bold">Cliente</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider font-bold">Fecha</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider font-bold">Estado</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {docs.map(doc => {
                const t = TIPO_STYLE[doc.tipo] ?? { label: doc.tipo, color: '#000' };
                return (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-2.5 font-bold">{doc.numero}</td>
                    <td className="py-2.5 font-bold text-xs" style={{ color: t.color }}>
                      {t.label}
                    </td>
                    <td className="py-2.5">{doc.cliente || '—'}</td>
                    <td className="py-2.5 text-gray-600">{doc.fecha || '—'}</td>
                    <td className="py-2.5">
                      <select
                        value={doc.estado || ''}
                        onChange={e => handleEstadoChange(doc.id, e.target.value)}
                        className={`bg-transparent border-none text-xs font-bold uppercase tracking-wider focus:outline-none cursor-pointer ${ESTADO_STYLE[doc.estado] ?? 'text-gray-400'}`}
                      >
                        {!doc.estado && <option value="">—</option>}
                        {ESTADOS.map(e => (
                          <option key={e} value={e}>{e}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 text-right">
                      <Link
                        to={`/factura/${doc.id}`}
                        className="text-xs underline text-gray-600 hover:text-black"
                      >
                        Ver →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
