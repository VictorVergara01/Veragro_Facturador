import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { formatDate } from '../utils';

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
  const [busqueda, setBusqueda] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [verCanceladas, setVerCanceladas] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    setLoading(true);
    const url = verCanceladas ? '/api/documentos?canceladas=true' : '/api/documentos';
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setDocs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [verCanceladas]);

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

  const docsFiltrados = docs.filter(doc => {
    const q = busqueda.toLowerCase();
    const matchBusqueda = !q ||
      doc.numero.toLowerCase().includes(q) ||
      (doc.cliente || '').toLowerCase().includes(q) ||
      (doc.estado || '').toLowerCase().includes(q) ||
      formatDate(doc.fecha).toLowerCase().includes(q);
    const matchTipo = !tipoFiltro || doc.tipo === tipoFiltro;
    return matchBusqueda && matchTipo;
  });

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
          <span className="text-4xl font-bold tracking-tight">VER</span>
          <span className="text-4xl font-bold tracking-tight" style={{ color: '#c8f060' }}>AGRO</span>
          <span className="text-xs tracking-[0.4em] text-gray-400 mb-0.5">DRONES</span>
        </div>

        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Documentos — {docsFiltrados.length}{docsFiltrados.length !== docs.length ? ` de ${docs.length}` : ''} registros
          </h2>
          <Link
            to="/nueva"
            className="px-4 py-1.5 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            + Nueva
          </Link>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-5 items-center">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por número, cliente, fecha..."
            className="border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black flex-1 min-w-48"
          />
          <div className="flex gap-1">
            {['', 'FAC', 'COT', 'SER'].map(t => (
              <button
                key={t}
                onClick={() => setTipoFiltro(t)}
                className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold border transition-colors ${
                  tipoFiltro === t ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}
              >
                {t || 'Todos'}
              </button>
            ))}
          </div>
          <button
            onClick={() => setVerCanceladas(v => !v)}
            className={`px-3 py-1.5 text-xs uppercase tracking-wider font-bold border transition-colors ${
              verCanceladas ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-400 border-gray-200 hover:border-gray-400'
            }`}
          >
            {verCanceladas ? '✕ Canceladas' : 'Ver canceladas'}
          </button>
        </div>

        {docsFiltrados.length === 0 ? (
          <p className="text-sm text-gray-400">
            {busqueda || tipoFiltro ? 'Sin resultados para esta búsqueda.' : 'No hay documentos.'}
          </p>
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
              {docsFiltrados.map(doc => {
                const t = TIPO_STYLE[doc.tipo] ?? { label: doc.tipo, color: '#000' };
                return (
                  <tr key={doc.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    doc.estado === 'Cancelada' ? 'opacity-50' : ''
                  }`}>
                    <td className="py-2.5 font-bold">{doc.numero}</td>
                    <td className="py-2.5 font-bold text-xs" style={{ color: t.color }}>
                      {t.label}
                    </td>
                    <td className="py-2.5">{doc.cliente || '—'}</td>
                    <td className="py-2.5 text-gray-600">{formatDate(doc.fecha)}</td>
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
