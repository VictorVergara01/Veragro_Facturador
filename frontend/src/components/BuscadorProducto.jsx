import { useState, useEffect, useRef } from 'react';

export default function BuscadorProducto({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(() => {
      fetch(`/api/inventario?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(data => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
  }, [query]);

  function handleSelect(product) {
    onSelect(product);
    setQuery('');
    setResults([]);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar en inventario por nombre o SKU..."
        className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-black"
      />
      {loading && (
        <span className="absolute right-3 top-2.5 text-xs text-gray-400">...</span>
      )}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 z-20 max-h-52 overflow-y-auto shadow-sm">
          {results.map(p => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => handleSelect(p)}
              className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 border-b border-gray-100 last:border-0 flex items-center gap-3"
            >
              <span className="text-gray-400 w-28 shrink-0 truncate">{p.sku || '—'}</span>
              <span className="flex-1">{p.nombre}</span>
              <span className="text-gray-500 shrink-0">${Number(p.precio).toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
      {open && results.length === 0 && !loading && query.trim() && (
        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 border-t-0 z-20 px-3 py-2.5 text-xs text-gray-400 shadow-sm">
          Sin resultados — se creará como producto nuevo en inventario al guardar
        </div>
      )}
    </div>
  );
}
