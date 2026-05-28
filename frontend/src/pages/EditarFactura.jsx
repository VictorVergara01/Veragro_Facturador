import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import BuscadorProducto from '../components/BuscadorProducto';

const ESTADOS = ['Borrador', 'Enviada', 'Pagada', 'Cancelada'];
const ESTADO_COLOR = {
  Borrador: 'text-gray-500',
  Enviada: 'text-blue-600',
  Pagada: 'text-green-700',
  Cancelada: 'text-red-600',
};

const emptyLine = { sku: '', descripcion: '', cantidad: 1, precio: 0, descuento: 0 };

export default function EditarFactura() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newLine, setNewLine] = useState(emptyLine);
  const [addingLine, setAddingLine] = useState(false);
  const [fromCatalog, setFromCatalog] = useState(false);
  const [savingEstado, setSavingEstado] = useState(false);

  useEffect(() => {
    fetch(`/api/documentos/${id}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        setDoc(data);
        setLineas(data.lineas);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleEstadoChange(estado) {
    setSavingEstado(true);
    try {
      await fetch(`/api/documentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      setDoc(prev => ({ ...prev, estado }));
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setSavingEstado(false);
    }
  }

  async function handleAddLine() {
    if (!newLine.descripcion.trim()) return;
    setAddingLine(true);
    try {
      if (!fromCatalog && newLine.descripcion.trim()) {
        await fetch('/api/inventario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: newLine.sku,
            nombre: newLine.descripcion,
            precio: newLine.precio,
          }),
        }).catch(() => {});
      }

      const resp = await fetch(`/api/documentos/${id}/lineas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLine),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error);
      }
      const linea = await resp.json();
      setLineas(prev => [...prev, linea]);
      setNewLine(emptyLine);
      setFromCatalog(false);
    } catch (e) {
      alert(`Error: ${e.message}`);
    } finally {
      setAddingLine(false);
    }
  }

  async function handleUpdateLine(lineId, field, value) {
    try {
      await fetch(`/api/lineas/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: field === 'descripcion' || field === 'sku' ? value : Number(value) }),
      });
    } catch (e) {
      alert(`Error guardando: ${e.message}`);
    }
  }

  async function handleDeleteLine(lineId) {
    if (!confirm('¿Eliminar esta línea?')) return;
    try {
      await fetch(`/api/lineas/${lineId}`, { method: 'DELETE' });
      setLineas(prev => prev.filter(l => l.id !== lineId));
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  async function handleCancelDocument() {
    if (!confirm(`¿Marcar ${doc.numero} como Cancelada?`)) return;
    try {
      const resp = await fetch(`/api/documentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Cancelada' }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      setDoc(prev => ({ ...prev, estado: 'Cancelada' }));
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  function handleCatalogSelect(product) {
    setNewLine({
      sku: product.sku || '',
      descripcion: product.nombre || '',
      cantidad: 1,
      precio: product.precio || 0,
      descuento: 0,
    });
    setFromCatalog(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono">
        <p className="text-gray-500 tracking-widest text-sm">Cargando...</p>
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

  const subtotal = lineas.reduce((s, l) => {
    const d = l.descuento ?? 0;
    return s + l.cantidad * l.precio * (1 - d / 100);
  }, 0);

  return (
    <div className="min-h-screen bg-white p-8 font-mono">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="text-3xl font-bold tracking-tight">
              <span>AGRO</span>
              <span style={{ color: '#c8f060' }}>TECH</span>
            </div>
            <div className="text-xs tracking-[0.4em] text-gray-400 mt-0.5">DRONES</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tracking-widest" style={{ color: '#c8371a' }}>
              {doc.tipoLabel}
            </div>
            <div className="text-sm font-bold mt-1">{doc.numero}</div>
          </div>
        </div>

        <Link to={`/factura/${id}`} className="text-xs text-gray-400 underline hover:text-black">
          ← Ver documento
        </Link>

        <hr className="border-black my-4" />

        {/* Meta + estado */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">Cliente</div>
            <div className="font-bold">{doc.cliente}</div>
            <div className="text-sm text-gray-500 mt-1">{doc.fecha}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Estado</div>
            <div className="flex gap-2 flex-wrap">
              {ESTADOS.map(e => (
                <button
                  key={e}
                  onClick={() => handleEstadoChange(e)}
                  disabled={savingEstado}
                  className={`px-3 py-1 text-xs border font-bold uppercase tracking-wider transition-colors ${
                    doc.estado === e
                      ? 'bg-black text-white border-black'
                      : 'bg-white border-gray-200 hover:border-gray-500 ' + ESTADO_COLOR[e]
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        <hr className="border-black mb-6" />

        {/* Tabla de líneas */}
        <div className="text-xs uppercase tracking-widest text-gray-400 mb-3 font-bold">
          Líneas de producto
        </div>

        {lineas.length > 0 ? (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="text-left py-2 text-xs uppercase tracking-wider w-28">SKU</th>
                <th className="text-left py-2 text-xs uppercase tracking-wider">Producto</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider w-20">Cant.</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Precio</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider w-16">Desc.%</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider w-24">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineas.map(l => {
                const lineTotal = l.cantidad * l.precio * (1 - (l.descuento ?? 0) / 100);
                return (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-400 text-xs">{l.sku || '—'}</td>
                    <td className="py-1.5 text-xs">{l.descripcion}</td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        defaultValue={l.cantidad}
                        min="0"
                        className="w-16 text-right border border-transparent hover:border-gray-300 focus:border-black focus:outline-none px-1 py-0.5 font-mono text-sm"
                        onBlur={e => handleUpdateLine(l.id, 'cantidad', e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        defaultValue={l.precio}
                        min="0"
                        step="0.01"
                        className="w-20 text-right border border-transparent hover:border-gray-300 focus:border-black focus:outline-none px-1 py-0.5 font-mono text-sm"
                        onBlur={e => handleUpdateLine(l.id, 'precio', e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 text-right">
                      <input
                        type="number"
                        defaultValue={l.descuento ?? 0}
                        min="0"
                        max="100"
                        className="w-12 text-right border border-transparent hover:border-gray-300 focus:border-black focus:outline-none px-1 py-0.5 font-mono text-sm"
                        onBlur={e => handleUpdateLine(l.id, 'descuento', e.target.value)}
                      />
                    </td>
                    <td className="py-1.5 text-right font-medium">${lineTotal.toFixed(2)}</td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => handleDeleteLine(l.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-xs px-1"
                        title="Eliminar línea"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 mb-6">Sin líneas. Añade productos abajo.</p>
        )}

        {/* Subtotal */}
        {lineas.length > 0 && (
          <div className="flex justify-end mb-8">
            <div className="text-sm font-bold border-t-2 border-black pt-2 w-48 flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
          </div>
        )}

        <hr className="border-black mb-6" />

        {/* Formulario nueva línea */}
        <div className="text-xs uppercase tracking-widest text-gray-400 mb-4 font-bold">
          Añadir producto
        </div>

        <div className="border border-gray-200 bg-gray-50 p-5 mb-8">
          <div className="mb-4">
            <label className="text-xs uppercase tracking-wider text-gray-400 block mb-2">
              Buscar en inventario
            </label>
            <BuscadorProducto onSelect={handleCatalogSelect} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-400 block mb-1">SKU</label>
              <input
                type="text"
                value={newLine.sku}
                onChange={e => { setNewLine(p => ({ ...p, sku: e.target.value })); setFromCatalog(false); }}
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-400 block mb-1">
                Producto <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={newLine.descripcion}
                onChange={e => { setNewLine(p => ({ ...p, descripcion: e.target.value })); setFromCatalog(false); }}
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-400 block mb-1">Precio c/u</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newLine.precio}
                onChange={e => setNewLine(p => ({ ...p, precio: Number(e.target.value) }))}
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-400 block mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={newLine.cantidad}
                onChange={e => setNewLine(p => ({ ...p, cantidad: Number(e.target.value) }))}
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-gray-400 block mb-1">Descuento %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={newLine.descuento}
                onChange={e => setNewLine(p => ({ ...p, descuento: Number(e.target.value) }))}
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleAddLine}
              disabled={!newLine.descripcion.trim() || addingLine}
              className="px-6 py-2 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {addingLine ? 'Añadiendo...' : '+ Añadir línea'}
            </button>
            {!fromCatalog && newLine.descripcion.trim() && (
              <span className="text-xs text-gray-400 italic">
                Producto nuevo — se guardará en inventario
              </span>
            )}
          </div>
        </div>

        {/* Botón finalizar */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(`/factura/${id}`)}
            className="px-8 py-2.5 bg-black text-white font-mono text-xs uppercase tracking-widest hover:bg-gray-800 transition-colors"
          >
            Guardar y ver documento →
          </button>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</span>
            <button
              onClick={handleCancelDocument}
              className="text-xs text-red-400 hover:text-red-600 underline transition-colors"
            >
              Cancelar documento
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
