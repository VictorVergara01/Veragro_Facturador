# Crear y Editar Facturas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir flujo de dos pasos para crear FAC/COT/SER y gestionar sus líneas de producto desde el facturador, sincronizando con Notion.

**Architecture:** Nuevos endpoints Express que envuelven el SDK de Notion para crear páginas, sub-bases de datos y líneas. El frontend añade dos rutas: `/nueva` (formulario de creación) y `/factura/:id/editar` (gestor de líneas con buscador de inventario).

**Tech Stack:** Node.js/Express, @notionhq/client v5, React 18, React Router v6, Tailwind CSS

---

## File Structure

**Crear:**
- `backend/src/clientes.js` — `listClientes(notion)`
- `backend/src/inventario.js` — `searchInventario(notion, query)`, `createInventarioProduct(notion, data)`
- `backend/src/__tests__/createDocument.test.js` — tests de numeración automática
- `frontend/src/pages/NuevaFactura.jsx` — formulario paso 1
- `frontend/src/pages/EditarFactura.jsx` — editor de líneas paso 2
- `frontend/src/components/BuscadorProducto.jsx` — input con dropdown de inventario

**Modificar:**
- `backend/.env` + `backend/.env.example` — dos vars nuevas
- `backend/src/notion.js` — añadir `computeNextNumber`, `createDocument`, `updateDocument`, `addLineItem`, `updateLineItem`, `deleteLineItem`; añadir `id` a cada línea en `getLineItems`
- `backend/src/server.js` — 7 endpoints nuevos
- `frontend/src/App.jsx` — 2 rutas nuevas
- `frontend/src/pages/Lista.jsx` — botón "Nueva Factura"
- `frontend/src/pages/Factura.jsx` — botón "Editar"

---

## Task 1: Variables de entorno

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`

- [ ] **Step 1: Añadir vars a backend/.env**

Añadir al final de `backend/.env`:
```
NOTION_DB_CLIENTES=<id de la DB de clientes>
NOTION_DB_INVENTARIO=<id de "📦 Gestión de inventario">
```

- [ ] **Step 2: Añadir vars a backend/.env.example**

Añadir al final de `backend/.env.example`:
```
NOTION_DB_CLIENTES=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NOTION_DB_INVENTARIO=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Para obtener cada ID: abrir la base de datos en Notion en el navegador → la URL tiene el formato `notion.so/<ID>?v=...`. El ID es la cadena de 32 caracteres hexadecimales antes del `?v=`.

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "feat: add NOTION_DB_CLIENTES and NOTION_DB_INVENTARIO env vars"
```

---

## Task 2: clientes.js + GET /api/clientes

**Files:**
- Create: `backend/src/clientes.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Crear backend/src/clientes.js**

```js
async function listClientes(notion) {
  const resp = await notion.request({
    path: `databases/${process.env.NOTION_DB_CLIENTES}/query`,
    method: 'post',
    body: { sorts: [{ property: 'Nombre', direction: 'ascending' }] },
  });

  return resp.results.map(page => {
    const titleProp = Object.values(page.properties).find(v => v.type === 'title');
    return {
      id: page.id,
      nombre: titleProp?.title?.[0]?.plain_text ?? '',
    };
  }).filter(c => c.nombre);
}

module.exports = { listClientes };
```

> Nota: si la propiedad de ordenamiento `Nombre` no existe en la DB de clientes, cambiar a la propiedad correcta o eliminar el `sorts`.

- [ ] **Step 2: Añadir endpoint a server.js**

Después de la línea `const { applyDiscountAndTax } = require('./calculateTotals');` en `backend/src/server.js`, añadir:

```js
const { listClientes } = require('./clientes');
```

Y después de `app.get('/health', ...)`:

```js
app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await listClientes(notion);
    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verificar endpoint**

Con el backend corriendo:
```powershell
curl http://localhost:3000/api/clientes
```

Esperado: array JSON con `[{ "id": "...", "nombre": "..." }, ...]`

- [ ] **Step 4: Commit**

```bash
git add backend/src/clientes.js backend/src/server.js
git commit -m "feat: GET /api/clientes — list clients from Notion"
```

---

## Task 3: inventario.js + GET /api/inventario

**Files:**
- Create: `backend/src/inventario.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Crear backend/src/inventario.js**

```js
async function searchInventario(notion, query) {
  const resp = await notion.request({
    path: `databases/${process.env.NOTION_DB_INVENTARIO}/query`,
    method: 'post',
    body: { page_size: 100 },
  });

  const items = resp.results.map(page => {
    const p = page.properties;
    const titleProp = Object.values(p).find(v => v.type === 'title');
    const nombre = titleProp?.title?.[0]?.plain_text ?? '';
    const sku = p['SKU']?.rich_text?.[0]?.plain_text ?? '';
    const precio = p['Precio c/u']?.number ?? p['Precio']?.number ?? 0;
    return { id: page.id, nombre, sku, precio };
  }).filter(i => i.nombre);

  if (!query) return items;

  const q = query.toLowerCase();
  return items.filter(i =>
    i.nombre.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
  );
}

async function createInventarioProduct(notion, { sku, nombre, precio }) {
  const titleProp = await getInventarioTitleProp(notion);
  const props = {
    [titleProp]: { title: [{ text: { content: nombre } }] },
  };
  if (sku) props['SKU'] = { rich_text: [{ text: { content: sku } }] };
  if (precio) props['Precio c/u'] = { number: precio };

  const page = await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_INVENTARIO },
    properties: props,
  });
  return { id: page.id };
}

let _inventarioTitleProp = null;
async function getInventarioTitleProp(notion) {
  if (_inventarioTitleProp) return _inventarioTitleProp;
  const db = await notion.databases.retrieve({
    database_id: process.env.NOTION_DB_INVENTARIO,
  });
  const entry = Object.entries(db.properties).find(([, v]) => v.type === 'title');
  _inventarioTitleProp = entry ? entry[0] : 'Nombre';
  return _inventarioTitleProp;
}

module.exports = { searchInventario, createInventarioProduct };
```

> Nota: si el precio en la DB de inventario tiene un nombre distinto a `Precio c/u` o `Precio`, ajustar en `searchInventario`. El campo `SKU` debe ser `rich_text`.

- [ ] **Step 2: Añadir import y endpoint a server.js**

Añadir después del import de `clientes`:
```js
const { searchInventario, createInventarioProduct } = require('./inventario');
```

Añadir endpoint después de `/api/clientes`:
```js
app.get('/api/inventario', async (req, res) => {
  try {
    const items = await searchInventario(notion, req.query.q || '');
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verificar endpoint**

```powershell
curl "http://localhost:3000/api/inventario?q=DJI"
```

Esperado: array con productos cuyo nombre o SKU contiene "DJI".

```powershell
curl "http://localhost:3000/api/inventario"
```

Esperado: todos los productos (hasta 100).

- [ ] **Step 4: Commit**

```bash
git add backend/src/inventario.js backend/src/server.js
git commit -m "feat: GET /api/inventario — search inventory products from Notion"
```

---

## Task 4: computeNextNumber + createDocument en notion.js

**Files:**
- Modify: `backend/src/notion.js`
- Create: `backend/src/__tests__/createDocument.test.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Escribir tests de computeNextNumber primero**

Crear `backend/src/__tests__/createDocument.test.js`:

```js
const { computeNextNumber } = require('../notion');

describe('computeNextNumber', () => {
  test('starts at 001 when no existing docs', () => {
    expect(computeNextNumber('FAC', [])).toBe('FAC-001');
  });

  test('increments from highest number of matching type', () => {
    expect(computeNextNumber('FAC', ['FAC-001', 'FAC-003', 'SER-002'])).toBe('FAC-004');
  });

  test('ignores other types', () => {
    expect(computeNextNumber('COT', ['FAC-001', 'FAC-002'])).toBe('COT-001');
  });

  test('pads to 3 digits', () => {
    expect(computeNextNumber('SER', ['SER-009'])).toBe('SER-010');
  });

  test('handles large numbers', () => {
    expect(computeNextNumber('FAC', ['FAC-099'])).toBe('FAC-100');
  });
});
```

- [ ] **Step 2: Ejecutar tests para confirmar que fallan**

```powershell
cd backend; npm test -- createDocument.test.js
```

Esperado: `FAIL` — `computeNextNumber is not a function`

- [ ] **Step 3: Añadir computeNextNumber a notion.js**

Añadir antes de `module.exports` en `backend/src/notion.js`:

```js
function computeNextNumber(prefix, allNumbers) {
  const nums = allNumbers
    .filter(n => n.startsWith(`${prefix}-`))
    .map(n => parseInt(n.split('-')[1], 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}
```

Actualizar `module.exports`:
```js
module.exports = { createNotionClient, listDocuments, getDocument, computeNextNumber };
```

- [ ] **Step 4: Ejecutar tests para confirmar que pasan**

```powershell
cd backend; npm test -- createDocument.test.js
```

Esperado: `PASS` — 5 tests pasan.

- [ ] **Step 5: Añadir createDocument a notion.js**

El mapa de tipo UI (FAC/COT/SER) a label de Notion select:
```js
const TIPO_SELECT = {
  FAC: 'Factura',
  COT: 'Cotización',
  SER: 'Factura de Servicio',
};
```

Ya existe `TIPO_PREFIX` y `TIPO_LABELS` en el archivo. Añadir `TIPO_SELECT` después de `TIPO_LABELS`.

Añadir esta función antes de `module.exports`:

```js
let _ventasTitleProp = null;
async function getVentasTitleProp(notion) {
  if (_ventasTitleProp) return _ventasTitleProp;
  const db = await notion.databases.retrieve({
    database_id: process.env.NOTION_DB_VENTAS,
  });
  const entry = Object.entries(db.properties).find(([, v]) => v.type === 'title');
  _ventasTitleProp = entry ? entry[0] : 'Número';
  return _ventasTitleProp;
}

async function createDocument(notion, { tipo, clienteId, fecha, notas }) {
  // 1. Obtener todos los números existentes para calcular el siguiente
  const resp = await notion.request({
    path: `databases/${process.env.NOTION_DB_VENTAS}/query`,
    method: 'post',
    body: { page_size: 100 },
  });
  const allNumbers = resp.results.map(p => getTitleText(p.properties));
  const numero = computeNextNumber(tipo, allNumbers);

  // 2. Crear la página en la DB de ventas
  const titleProp = await getVentasTitleProp(notion);
  const props = {
    [titleProp]: { title: [{ text: { content: numero } }] },
    'Tipo': { select: { name: TIPO_SELECT[tipo] ?? tipo } },
    'Cliente': { relation: [{ id: clienteId }] },
    'Fecha': { date: { start: fecha } },
    'Estado': { select: { name: 'Borrador' } },
  };
  if (notas) props['Notas'] = { rich_text: [{ text: { content: notas } }] };

  const page = await notion.pages.create({
    parent: { database_id: process.env.NOTION_DB_VENTAS },
    properties: props,
  });

  // 3. Crear la sub-BD de líneas dentro de la página
  await notion.databases.create({
    parent: { type: 'page_id', page_id: page.id },
    title: [{ type: 'text', text: { content: 'Productos Mantenimiento' } }],
    properties: {
      'Producto': { title: {} },
      'SKU': { rich_text: {} },
      'Cantidad': { number: { format: 'number' } },
      'Precio c/u': { number: { format: 'number' } },
      'Descuento %': { number: { format: 'number' } },
    },
  });

  return { id: page.id, numero };
}
```

Actualizar `module.exports`:
```js
module.exports = { createNotionClient, listDocuments, getDocument, computeNextNumber, createDocument };
```

- [ ] **Step 6: Añadir endpoint POST /api/documentos a server.js**

Después del endpoint `GET /api/inventario`:

```js
app.post('/api/documentos', async (req, res) => {
  try {
    const { tipo, clienteId, fecha, notas } = req.body;
    if (!tipo || !clienteId || !fecha) {
      return res.status(400).json({ error: 'tipo, clienteId y fecha son requeridos' });
    }
    const result = await createDocument(notion, { tipo, clienteId, fecha, notas });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

Actualizar el import de notion al inicio:
```js
const { createNotionClient, listDocuments, getDocument, createDocument } = require('./notion');
```

- [ ] **Step 7: Ejecutar suite completa de tests**

```powershell
cd backend; npm test
```

Esperado: todos los tests pasan (calculateTotals + pdf + createDocument).

- [ ] **Step 8: Commit**

```bash
git add backend/src/notion.js backend/src/__tests__/createDocument.test.js backend/src/server.js
git commit -m "feat: createDocument with auto-numbering + POST /api/documentos"
```

---

## Task 5: updateDocument + CRUD de líneas

**Files:**
- Modify: `backend/src/notion.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Añadir id a cada línea en getLineItems**

En `backend/src/notion.js`, dentro de `getLineItems`, cambiar el `return` del map:

```js
  return items.results.map((item) => {
    const p = item.properties;

    const descripcion =
      p['Producto']?.title?.[0]?.plain_text
      ?? p['Producto']?.rich_text?.[0]?.plain_text
      ?? '';

    const sku =
      p['SKU']?.rich_text?.[0]?.plain_text
      ?? p['SKU']?.title?.[0]?.plain_text
      ?? '';

    return {
      id: item.id,       // <-- añadir esto
      sku,
      descripcion,
      cantidad: p['Cantidad']?.number ?? 0,
      precio: p['Precio c/u']?.number ?? 0,
      descuento: p['Descuento %']?.number ?? 0,
    };
  });
```

- [ ] **Step 2: Añadir updateDocument, addLineItem, updateLineItem, deleteLineItem a notion.js**

Añadir antes de `module.exports`:

```js
async function updateDocument(notion, pageId, updates) {
  const props = {};
  if (updates.estado) props['Estado'] = { select: { name: updates.estado } };
  if (updates.notas !== undefined) {
    props['Notas'] = { rich_text: updates.notas ? [{ text: { content: updates.notas } }] : [] };
  }
  if (updates.fecha) props['Fecha'] = { date: { start: updates.fecha } };

  return notion.pages.update({ page_id: pageId, properties: props });
}

async function addLineItem(notion, pageId, { sku, descripcion, cantidad, precio, descuento }) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  const dbBlock = blocks.results.find(b => b.type === 'child_database');
  if (!dbBlock) throw new Error('No se encontró la sub-BD de líneas en esta factura');

  const page = await notion.pages.create({
    parent: { database_id: dbBlock.id },
    properties: {
      'Producto': { title: [{ text: { content: descripcion || '' } }] },
      'SKU': { rich_text: [{ text: { content: sku || '' } }] },
      'Cantidad': { number: Number(cantidad) || 0 },
      'Precio c/u': { number: Number(precio) || 0 },
      'Descuento %': { number: Number(descuento) || 0 },
    },
  });

  return {
    id: page.id,
    sku: sku || '',
    descripcion: descripcion || '',
    cantidad: Number(cantidad) || 0,
    precio: Number(precio) || 0,
    descuento: Number(descuento) || 0,
  };
}

async function updateLineItem(notion, lineId, updates) {
  const props = {};
  if (updates.cantidad !== undefined) props['Cantidad'] = { number: Number(updates.cantidad) };
  if (updates.precio !== undefined) props['Precio c/u'] = { number: Number(updates.precio) };
  if (updates.descuento !== undefined) props['Descuento %'] = { number: Number(updates.descuento) };
  if (updates.descripcion !== undefined) {
    props['Producto'] = { title: [{ text: { content: updates.descripcion } }] };
  }
  if (updates.sku !== undefined) {
    props['SKU'] = { rich_text: [{ text: { content: updates.sku } }] };
  }

  return notion.pages.update({ page_id: lineId, properties: props });
}

async function deleteLineItem(notion, lineId) {
  return notion.pages.update({ page_id: lineId, archived: true });
}
```

Actualizar `module.exports`:
```js
module.exports = {
  createNotionClient, listDocuments, getDocument,
  computeNextNumber, createDocument,
  updateDocument, addLineItem, updateLineItem, deleteLineItem,
};
```

- [ ] **Step 3: Añadir los 4 endpoints restantes a server.js**

Actualizar el import de notion:
```js
const {
  createNotionClient, listDocuments, getDocument, createDocument,
  updateDocument, addLineItem, updateLineItem, deleteLineItem,
} = require('./notion');
```

Añadir los endpoints después de `POST /api/documentos`:

```js
app.put('/api/documentos/:id', async (req, res) => {
  try {
    await updateDocument(notion, req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documentos/:id/lineas', async (req, res) => {
  try {
    const linea = await addLineItem(notion, req.params.id, req.body);
    res.json(linea);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lineas/:id', async (req, res) => {
  try {
    await updateLineItem(notion, req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lineas/:id', async (req, res) => {
  try {
    await deleteLineItem(notion, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/notion.js backend/src/server.js
git commit -m "feat: updateDocument, addLineItem, updateLineItem, deleteLineItem + endpoints"
```

---

## Task 6: App.jsx + botones de navegación

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/pages/Lista.jsx`
- Modify: `frontend/src/pages/Factura.jsx`

- [ ] **Step 1: Añadir rutas a App.jsx**

Reemplazar el contenido de `frontend/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lista from './pages/Lista';
import Factura from './pages/Factura';
import Verify from './pages/Verify';
import NuevaFactura from './pages/NuevaFactura';
import EditarFactura from './pages/EditarFactura';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/nueva" element={<NuevaFactura />} />
        <Route path="/factura/:id" element={<Factura />} />
        <Route path="/factura/:id/editar" element={<EditarFactura />} />
        <Route path="/verify/:codigo" element={<Verify />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Añadir botón "Nueva Factura" a Lista.jsx**

En `frontend/src/pages/Lista.jsx`, añadir `Link` al import:
```jsx
import { Link } from 'react-router-dom';
```
(ya existe)

Reemplazar el bloque del encabezado de la tabla:
```jsx
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
```

(el `<div className="border-b-2 border-black pb-2 mb-6">` original se convierte en flex con justify-between)

- [ ] **Step 3: Añadir botón "Editar" a Factura.jsx**

En `frontend/src/pages/Factura.jsx`, añadir `useNavigate` al import de react-router-dom:
```jsx
import { useParams, Link, useNavigate } from 'react-router-dom';
```

Añadir `const navigate = useNavigate();` después de los useState.

En el bloque de opciones de PDF (`<div className="border border-gray-200 bg-gray-50 p-5">`), añadir botón "Editar" antes de "Descargar PDF":

```jsx
            <button
              onClick={() => navigate(`/factura/${id}/editar`)}
              className="px-6 py-2 border border-black text-black font-mono text-xs uppercase tracking-widest hover:bg-gray-100 transition-colors"
            >
              Editar
            </button>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.jsx frontend/src/pages/Lista.jsx frontend/src/pages/Factura.jsx
git commit -m "feat: add routes /nueva and /factura/:id/editar, nav buttons"
```

---

## Task 7: NuevaFactura.jsx

**Files:**
- Create: `frontend/src/pages/NuevaFactura.jsx`

- [ ] **Step 1: Crear frontend/src/pages/NuevaFactura.jsx**

```jsx
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
          <span className="text-4xl font-bold tracking-tight">AGRO</span>
          <span className="text-4xl font-bold tracking-tight" style={{ color: '#c8f060' }}>TECH</span>
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
          <div className="flex gap-3">
            {TIPOS.map(t => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
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
```

- [ ] **Step 2: Verificar en browser**

Con backend y frontend corriendo, ir a `http://localhost:5173/nueva`. Verificar:
- Los 3 botones de tipo cambian de color al seleccionarlos
- El dropdown de cliente carga los clientes de Notion
- El botón "Crear" está deshabilitado hasta que tipo + cliente estén seleccionados
- Al crear, redirige a `/factura/:id/editar` (que aún no existe — mostrará error de ruta)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/NuevaFactura.jsx
git commit -m "feat: NuevaFactura page — step 1 creation form"
```

---

## Task 8: BuscadorProducto.jsx

**Files:**
- Create: `frontend/src/components/BuscadorProducto.jsx`

- [ ] **Step 1: Crear frontend/src/components/BuscadorProducto.jsx**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BuscadorProducto.jsx
git commit -m "feat: BuscadorProducto component — debounced inventory search with dropdown"
```

---

## Task 9: EditarFactura.jsx

**Files:**
- Create: `frontend/src/pages/EditarFactura.jsx`

- [ ] **Step 1: Crear frontend/src/pages/EditarFactura.jsx**

```jsx
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
      // Si es producto manual (no del catálogo), crearlo en inventario
      if (!fromCatalog && newLine.descripcion.trim()) {
        await fetch('/api/inventario', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: newLine.sku,
            nombre: newLine.descripcion,
            precio: newLine.precio,
          }),
        }).catch(() => {}); // no bloquear si falla
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
          <span className="text-xs text-gray-400">{lineas.length} línea{lineas.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Añadir endpoint POST /api/inventario a server.js**

Este endpoint es llamado por EditarFactura cuando se añade un producto manual. Añadir en `server.js` después de `GET /api/inventario`:

```js
app.post('/api/inventario', async (req, res) => {
  try {
    const { sku, nombre, precio } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
    const result = await createInventarioProduct(notion, { sku, nombre, precio });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
```

- [ ] **Step 3: Verificar flujo completo en browser**

1. Ir a `http://localhost:5173` → clic en `+ Nueva`
2. Seleccionar tipo, cliente, fecha → clic "Crear y añadir productos"
3. En `/factura/:id/editar`:
   - Buscar un producto en el buscador → seleccionarlo → se autocompletan los campos
   - Ajustar cantidad → clic "Añadir línea" → aparece en la tabla
   - Escribir un producto manual (sin seleccionar del catálogo) → añadir → aparece nota "se guardará en inventario"
   - Cambiar cantidad de una línea existente haciendo clic en el número → modificar → clic fuera
   - Clic "✕" en una línea → confirmar → desaparece
   - Cambiar estado a "Enviada" → el botón cambia a activo
   - Clic "Guardar y ver documento" → redirige a la vista de lectura

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/EditarFactura.jsx backend/src/server.js
git commit -m "feat: EditarFactura page — line items CRUD with inventory search"
```

---

## Summary

Al completar todos los tasks, el sistema permite:
- Crear FAC/COT/SER con numeración automática desde `/nueva`
- Gestionar líneas de producto con búsqueda en `📦 Gestión de inventario`
- Productos manuales se guardan automáticamente al inventario de Notion
- Editar cantidad, precio y descuento por línea inline
- Cambiar estado del documento (Borrador → Enviada → Pagada → Cancelada)
- Todo sincronizado en tiempo real con Notion
