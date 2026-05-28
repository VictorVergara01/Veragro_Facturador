import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import TablaLineas from '../components/TablaLineas';
import Totales from '../components/Totales';

const ESTADOS = ['Borrador', 'Enviada', 'Pagada', 'Cancelada'];
const ESTADO_STYLE = {
  Borrador: 'text-gray-400',
  Enviada:  'text-blue-600',
  Pagada:   'text-green-700',
  Cancelada: 'text-red-500',
};

export default function Factura() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descuento, setDescuento] = useState(0);
  const [itbms, setItbms] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [formato, setFormato] = useState('Letter');
  const [metodoPago, setMetodoPago] = useState('');
  const [metodosOpciones, setMetodosOpciones] = useState([]);
  const navigate = useNavigate();

  async function handleEstadoChange(estado) {
    setDoc(prev => ({ ...prev, estado }));
    await fetch(`/api/documentos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    }).catch(() => {});
  }

  useEffect(() => {
    fetch('/api/opciones/metodo-pago')
      .then(r => r.json())
      .then(setMetodosOpciones)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`/api/documentos/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setDoc)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownloadPDF() {
    setGenerating(true);
    try {
      // subtotalBruto = suma de líneas con descuento por línea, antes del descuento global
      const subtotalBruto = Math.round(doc.lineas.reduce((s, l) => {
        const d = l.descuento ?? 0;
        return s + l.cantidad * l.precio * (1 - d / 100);
      }, 0) * 100) / 100;
      const subtotalConDesc = Math.round(subtotalBruto * (1 - descuento / 100) * 100) / 100;
      const itbmsAmt = itbms ? Math.round(subtotalConDesc * 0.07 * 100) / 100 : 0;

      const [pdfResp] = await Promise.all([
        fetch('/api/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notionId: id, descuento, itbms, formato }),
        }),
        fetch(`/api/documentos/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            descuento: descuento / 100,
            subtotal: subtotalBruto,
            itbmsAmt,
            ...(metodoPago ? { metodoPago } : {}),
          }),
        }),
      ]);

      if (!pdfResp.ok) {
        const err = await pdfResp.json();
        throw new Error(err.error || 'Error generando PDF');
      }
      const blob = await pdfResp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.numero}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        <p className="text-gray-500 tracking-widest text-sm">Cargando documento...</p>
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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-xs text-gray-500 underline hover:text-black">
            ← Volver a documentos
          </Link>
        </div>

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-3xl font-bold tracking-tight">
              <span>AGRO</span>
              <span style={{ color: '#c8f060' }}>TECH</span>
            </div>
            <div className="text-xs tracking-[0.4em] text-gray-400 mt-0.5">DRONES</div>
          </div>
          <div className="text-2xl font-bold tracking-widest" style={{ color: '#c8371a' }}>
            {doc.tipoLabel}
          </div>
        </div>

        <hr className="border-black mb-4" />

        {/* Meta */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Monto Total', value: `$${doc.lineas.reduce((s,l)=>s+l.cantidad*l.precio*(1-(l.descuento??0)/100),0).toFixed(2)}`, bold: true },
            { label: 'Fecha', value: doc.fecha || '—' },
            { label: 'Número', value: doc.numero, bold: true },
          ].map(({ label, value, bold }) => (
            <div key={label}>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">{label}</div>
              <div className={bold ? 'font-bold text-lg' : 'text-sm'}>{value}</div>
            </div>
          ))}
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Estado</div>
            <select
              value={doc.estado || ''}
              onChange={e => handleEstadoChange(e.target.value)}
              className={`bg-transparent border-none text-sm font-bold focus:outline-none cursor-pointer -ml-0.5 ${ESTADO_STYLE[doc.estado] ?? 'text-gray-400'}`}
            >
              {!doc.estado && <option value="">—</option>}
              {ESTADOS.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>
        </div>

        <hr className="border-black mb-4" />

        {/* Client */}
        <div className="grid grid-cols-2 gap-8 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Facturado a</div>
            <div className="font-bold">{doc.cliente}</div>
            {doc.ruc && <div className="text-sm text-gray-600">RUC: {doc.ruc}</div>}
            {doc.direccion && <div className="text-sm text-gray-600">{doc.direccion}</div>}
            {doc.telefono && <div className="text-sm text-gray-600">Tel: {doc.telefono}</div>}
            {doc.email && <div className="text-sm text-gray-600">{doc.email}</div>}
          </div>
          {doc.referencia && (
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Referencia / Orden de Trabajo
              </div>
              <div className="font-bold">{doc.referencia}</div>
            </div>
          )}
        </div>

        <hr className="border-black mb-4" />

        <TablaLineas lineas={doc.lineas} descuento={descuento} />
        <Totales lineas={doc.lineas} descuento={descuento} itbms={itbms} />

        <hr className="border-black my-6" />

        {/* PDF Options */}
        <div className="border border-gray-200 bg-gray-50 p-5">
          <div className="text-xs uppercase tracking-widest text-gray-400 mb-4 font-bold">
            Opciones de PDF
          </div>
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 block mb-1.5">
                Descuento global (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="1"
                value={descuento}
                onChange={e => setDescuento(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="border border-gray-300 bg-white px-2 py-1.5 w-20 font-mono text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div className="flex items-center gap-2 pb-1.5">
              <input
                type="checkbox"
                id="itbms"
                checked={itbms}
                onChange={e => setItbms(e.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <label htmlFor="itbms" className="text-sm cursor-pointer select-none">
                Aplicar ITBMS 7%
              </label>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 block mb-1.5">
                Método de pago
              </label>
              <select
                value={metodoPago}
                onChange={e => setMetodoPago(e.target.value)}
                className="border border-gray-300 bg-white px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-black"
              >
                <option value="">— Sin especificar</option>
                {metodosOpciones.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-500 block mb-1.5">
                Formato
              </label>
              <select
                value={formato}
                onChange={e => setFormato(e.target.value)}
                className="border border-gray-300 bg-white px-2 py-1.5 font-mono text-sm focus:outline-none focus:border-black"
              >
                <option value="Letter">Carta</option>
                <option value="Legal">Legal</option>
              </select>
            </div>
            <button
              onClick={() => navigate(`/factura/${id}/editar`)}
              className="px-6 py-2 border border-black text-black font-mono text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Editar
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={generating}
              className="px-6 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generando PDF...' : 'Descargar PDF'}
            </button>
          </div>
          {doc.notas && (
            <p className="text-xs text-gray-500 italic mt-4">{doc.notas}</p>
          )}
        </div>
      </div>
    </div>
  );
}
