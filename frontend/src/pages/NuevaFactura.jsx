import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const TIPOS = [
  { value: 'FAC', label: 'Factura', color: '#c8371a' },
  { value: 'COT', label: 'Cotización', color: '#1a5cc8' },
  { value: 'SER', label: 'Servicio', color: '#2a7a2a' },
];

export default function NuevaFactura() {
  const navigate = useNavigate();
  const [tipo, setTipo] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [clientes, setClientes] = useState([]);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [notas, setNotas] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [error, setError] = useState(null);
  const [siguienteNumero, setSiguienteNumero] = useState('');

  useEffect(() => {
    fetch('/api/clientes')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setClientes)
      .catch(e => setError(`Error cargando clientes: ${e.message}`))
      .finally(() => setLoadingClientes(false));
  }, []);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/documentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, clienteId, fecha, notas }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error creando documento');
      }
      const { id } = await resp.json();
      navigate(`/factura/${id}/editar`);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }

  const canSubmit = tipo && clienteId && fecha && !loading;

  return (
    <div className="min-h-screen bg-white p-8 font-mono">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-4xl font-bold tracking-tight">VER</span>
          <span className="text-4xl font-bold tracking-tight" style={{ color: '#c8f060' }}>AGRO</span>
          <span className="text-xs tracking-[0.4em] text-gray-400">DRONES</span>
        </div>
        <Link to="/" className="text-xs text-gray-400 underline hover:text-black">
          ← Volver
        </Link>

        <div className="border-b-2 border-black pb-2 mt-8 mb-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Nuevo Documento
          </h2>
        </div>

        {error && (
          <p className="text-red-600 text-sm mb-6 border border-red-200 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}

        {/* Tipo */}
        <div className="mb-8">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
            Tipo de documento <span className="text-red-500">*</span>
          </div>
          <div className="flex gap-3 flex-wrap items-center">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => {
                  setTipo(t.value);
                  setSiguienteNumero('');
                  fetch(`/api/siguiente-numero?tipo=${t.value}`)
                    .then(r => r.json())
                    .then(d => setSiguienteNumero(d.numero))
                    .catch(() => {});
                }}
                className={`px-6 py-2 text-xs uppercase tracking-widest border-2 font-bold transition-colors ${
                  tipo === t.value
                    ? 'text-white border-transparent'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
                style={tipo === t.value ? { backgroundColor: t.color, borderColor: t.color } : {}}
              >
                {t.label}
              </button>
            ))}
            {siguienteNumero && (
              <span className="text-xs text-gray-400 tracking-wider">
                → se creará como <span className="font-bold text-black">{siguienteNumero}</span>
              </span>
            )}
          </div>
        </div>

        {/* Cliente */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">
            Cliente <span className="text-red-500">*</span>
          </label>
          {loadingClientes ? (
            <p className="text-xs text-gray-400">Cargando clientes...</p>
          ) : (
            <select
              value={clienteId}
              onChange={e => setClienteId(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-black bg-white"
            >
              <option value="">Seleccionar cliente...</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          )}
        </div>

        {/* Fecha */}
        <div className="mb-6">
          <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">
            Fecha <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-black"
          />
        </div>

        {/* Notas */}
        <div className="mb-10">
          <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">
            Notas
          </label>
          <textarea
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            placeholder="Observaciones, instrucciones especiales..."
            className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-black resize-none"
          />
        </div>

        <div className="flex items-center gap-6">
          <button
            onClick={handleCreate}
            disabled={!canSubmit}
            className="px-8 py-2.5 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creando...' : 'Crear y añadir productos →'}
          </button>
          <Link to="/" className="text-xs text-gray-400 underline hover:text-black">
            Cancelar
          </Link>
        </div>
      </div>
    </div>
  );
}
