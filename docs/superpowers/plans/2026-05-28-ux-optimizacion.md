# UX Optimización — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar los tres puntos de fricción principales del facturador: falta de feedback visual, PDF incompleto, y lentitud al agregar productos.

**Architecture:** Toast system via React Context en App.jsx; PDF completado con env vars para datos bancarios y método de pago; EditarFactura mejorado con auto-foco, Enter para añadir, y feedback visual inline por fila.

**Tech Stack:** React 18, React Context, Tailwind CSS, Node/Express, Puppeteer

---

## File Structure

**Crear:**
- `frontend/src/components/Toast.jsx` — ToastProvider, useToast hook, ToastContainer

**Modificar:**
- `frontend/src/App.jsx` — envolver con ToastProvider
- `frontend/src/pages/Lista.jsx` — toasts en cambio de estado
- `frontend/src/pages/Factura.jsx` — toasts + pasar metodoPago al PDF
- `frontend/src/pages/EditarFactura.jsx` — toasts + inline feedback + autoFocus + Enter
- `frontend/src/components/BuscadorProducto.jsx` — prop autoFocus
- `backend/src/pdf.js` — env vars para datos bancarios + método de pago en PDF
- `backend/src/server.js` — pasar metodoPago a buildHTML
- `backend/.env` + `backend/.env.example` — nuevas vars EMPRESA_*

---

## Task 1: Toast component

**Files:**
- Create: `frontend/src/components/Toast.jsx`

- [ ] **Step 1: Crear frontend/src/components/Toast.jsx**

```jsx
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev.slice(-2), { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 font-mono pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-4 py-3 text-xs uppercase tracking-widest text-white shadow-lg ${
              t.type === 'success' ? 'bg-black' : 'bg-red-600'
            }`}
          >
            {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/Toast.jsx
git commit -m "feat: Toast notification system — ToastProvider + useToast hook"
```

---

## Task 2: Integrar ToastProvider en App.jsx

**Files:**
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Actualizar App.jsx**

Reemplazar el contenido de `frontend/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Lista from './pages/Lista';
import Factura from './pages/Factura';
import Verify from './pages/Verify';
import NuevaFactura from './pages/NuevaFactura';
import EditarFactura from './pages/EditarFactura';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Lista />} />
          <Route path="/nueva" element={<NuevaFactura />} />
          <Route path="/factura/:id" element={<Factura />} />
          <Route path="/factura/:id/editar" element={<EditarFactura />} />
          <Route path="/verify/:codigo" element={<Verify />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: wrap app with ToastProvider"
```

---

## Task 3: PDF — env vars para datos bancarios + método de pago

**Files:**
- Modify: `backend/.env`
- Modify: `backend/.env.example`
- Modify: `backend/src/pdf.js`
- Modify: `backend/src/server.js`

- [ ] **Step 1: Añadir vars a backend/.env**

Añadir al final de `backend/.env`:
```
EMPRESA_BANCO=Banco General
EMPRESA_TIPO_CUENTA=Corriente
EMPRESA_CUENTA=04-88-888888-8
EMPRESA_CUENTA_NOMBRE=AgroTech Drones S.A.
EMPRESA_YAPPY=+507 6000-0000
```

Reemplazar con los valores reales de AgroTech Drones.

- [ ] **Step 2: Añadir vars a backend/.env.example**

Añadir al final de `backend/.env.example`:
```
EMPRESA_BANCO=Banco General
EMPRESA_TIPO_CUENTA=Corriente
EMPRESA_CUENTA=04-88-888888-8
EMPRESA_CUENTA_NOMBRE=AgroTech Drones S.A.
EMPRESA_YAPPY=+507 6000-0000
```

- [ ] **Step 3: Actualizar buildHTML en pdf.js**

En `backend/src/pdf.js`, cambiar la firma de `buildHTML` para aceptar `metodoPago`:

```js
function buildHTML(data) {
  const {
    numero, tipoLabel, cliente, ruc, direccion, telefono, email,
    fecha, estado, notas, referencia,
    lineas, subtotalBruto, descuentoAmt, itbmsAmt, total,
    descuento, applyItbms, qrDataUrl, metodoPago,
  } = data;
```

Luego, en la sección de pago del HTML, reemplazar las líneas hardcodeadas:

```js
  const banco = process.env.EMPRESA_BANCO ?? 'Banco General';
  const tipoCuenta = process.env.EMPRESA_TIPO_CUENTA ?? 'Corriente';
  const cuenta = process.env.EMPRESA_CUENTA ?? '04-88-888888-8';
  const cuentaNombre = process.env.EMPRESA_CUENTA_NOMBRE ?? 'AgroTech Drones S.A.';
  const yappy = process.env.EMPRESA_YAPPY ?? '+507 6000-0000';
  const metodoPagoBlock = metodoPago
    ? `<div class="prow" style="margin-top:6px"><span class="pk">Método de pago:</span> ${esc(metodoPago)}</div>`
    : '';
```

Y reemplazar el bloque `<div class="pqr">` en el template:

```js
<div class="pqr">
  <div>
    <div class="plabel">Información de Pago</div>
    <div class="prow"><span class="pk">${esc(banco)}</span></div>
    <div class="prow">Cuenta ${esc(tipoCuenta)}: ${esc(cuenta)}</div>
    <div class="prow">A nombre de: ${esc(cuentaNombre)}</div>
    <div class="prow" style="margin-top:6px"><span class="pk">Yappy:</span> ${esc(yappy)}</div>
    ${metodoPagoBlock}
    ${notasBlock}
  </div>
  <div>
    <img class="qrimg" src="${qrDataUrl}" alt="QR Verificación">
    <div class="qrcap">Escanea para verificar</div>
  </div>
</div>
```

- [ ] **Step 4: Pasar metodoPago desde server.js a buildHTML**

En `backend/src/server.js`, en el endpoint `POST /api/pdf`:

```js
const { notionId, descuento = 0, itbms = false, formato = 'Letter', metodoPago = '' } = req.body;
```

Y en la llamada a `buildHTML`:
```js
const html = buildHTML({ ...doc, ...totals, descuento, applyItbms: itbms, qrDataUrl, metodoPago });
```

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example backend/src/pdf.js backend/src/server.js
git commit -m "feat: configurable payment info in PDF via env vars + show Método de pago"
```

---

## Task 4: Factura.jsx — toasts + pasar metodoPago al PDF

**Files:**
- Modify: `frontend/src/pages/Factura.jsx`

- [ ] **Step 1: Añadir useToast y reemplazar feedback**

Añadir import al inicio del archivo:
```jsx
import { useToast } from '../components/Toast';
```

Añadir hook dentro del componente (después de los useState):
```jsx
const { showToast } = useToast();
```

- [ ] **Step 2: Actualizar handleEstadoChange con toast**

Reemplazar:
```jsx
  async function handleEstadoChange(estado) {
    setDoc(prev => ({ ...prev, estado }));
    await fetch(`/api/documentos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    }).catch(() => {});
  }
```

Con:
```jsx
  async function handleEstadoChange(estado) {
    setDoc(prev => ({ ...prev, estado }));
    try {
      await fetch(`/api/documentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      showToast(`Estado: ${estado}`);
    } catch {
      showToast('Error al cambiar estado', 'error');
    }
  }
```

- [ ] **Step 3: Actualizar handleDownloadPDF con toast + pasar metodoPago al PDF**

Reemplazar el `fetch('/api/pdf', ...)` para incluir `metodoPago` y añadir toasts:

```jsx
  async function handleDownloadPDF() {
    setGenerating(true);
    try {
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
          body: JSON.stringify({ notionId: id, descuento, itbms, formato, metodoPago }),
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
      showToast(`PDF descargado: ${doc.numero}`);
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      setGenerating(false);
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Factura.jsx
git commit -m "feat: toasts in Factura + pass metodoPago to PDF endpoint"
```

---

## Task 5: Lista.jsx — toasts en cambio de estado

**Files:**
- Modify: `frontend/src/pages/Lista.jsx`

- [ ] **Step 1: Añadir useToast y actualizar handleEstadoChange**

Añadir import:
```jsx
import { useToast } from '../components/Toast';
```

Añadir hook dentro del componente:
```jsx
const { showToast } = useToast();
```

Reemplazar la función `handleEstadoChange`:
```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/Lista.jsx
git commit -m "feat: toasts in Lista for estado changes"
```

---

## Task 6: BuscadorProducto — prop autoFocus

**Files:**
- Modify: `frontend/src/components/BuscadorProducto.jsx`

- [ ] **Step 1: Añadir prop autoFocus al input**

Cambiar la firma del componente:
```jsx
export default function BuscadorProducto({ onSelect, autoFocus = false }) {
```

Y añadir `autoFocus={autoFocus}` al `<input>`:
```jsx
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar en inventario por nombre o SKU..."
        autoFocus={autoFocus}
        className="w-full border border-gray-300 px-3 py-2 font-mono text-sm focus:outline-none focus:border-black"
      />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/BuscadorProducto.jsx
git commit -m "feat: BuscadorProducto accepts autoFocus prop"
```

---

## Task 7: EditarFactura.jsx — toasts + inline feedback + autoFocus + Enter

**Files:**
- Modify: `frontend/src/pages/EditarFactura.jsx`

- [ ] **Step 1: Añadir imports y estado necesario**

Añadir import al inicio:
```jsx
import { useToast } from '../components/Toast';
```

Añadir dentro del componente, después de los useState existentes:
```jsx
  const { showToast } = useToast();
  const [lineStatus, setLineStatus] = useState({});
  const [searchKey, setSearchKey] = useState(0);
```

- [ ] **Step 2: Actualizar handleEstadoChange con toast**

Reemplazar:
```jsx
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
```

Con:
```jsx
  async function handleEstadoChange(estado) {
    setSavingEstado(true);
    try {
      await fetch(`/api/documentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      });
      setDoc(prev => ({ ...prev, estado }));
      showToast(`Estado: ${estado}`);
    } catch {
      showToast('Error al cambiar estado', 'error');
    } finally {
      setSavingEstado(false);
    }
  }
```

- [ ] **Step 3: Actualizar handleAddLine con toast + re-foco**

Reemplazar la función `handleAddLine` completa:
```jsx
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
      setSearchKey(k => k + 1);
      showToast('Línea añadida');
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    } finally {
      setAddingLine(false);
    }
  }
```

- [ ] **Step 4: Actualizar handleUpdateLine con feedback visual inline**

Reemplazar:
```jsx
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
```

Con:
```jsx
  async function handleUpdateLine(lineId, field, value) {
    setLineStatus(prev => ({ ...prev, [lineId]: 'saving' }));
    try {
      await fetch(`/api/lineas/${lineId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: field === 'descripcion' || field === 'sku' ? value : Number(value) }),
      });
      setLineStatus(prev => ({ ...prev, [lineId]: 'ok' }));
      setTimeout(() => setLineStatus(prev => { const n = { ...prev }; delete n[lineId]; return n; }), 800);
    } catch {
      setLineStatus(prev => ({ ...prev, [lineId]: 'error' }));
      showToast('Error al guardar línea', 'error');
      setTimeout(() => setLineStatus(prev => { const n = { ...prev }; delete n[lineId]; return n; }), 2000);
    }
  }
```

- [ ] **Step 5: Actualizar handleDeleteLine — quitar confirm(), añadir toast**

Reemplazar:
```jsx
  async function handleDeleteLine(lineId) {
    if (!confirm('¿Eliminar esta línea?')) return;
    try {
      await fetch(`/api/lineas/${lineId}`, { method: 'DELETE' });
      setLineas(prev => prev.filter(l => l.id !== lineId));
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }
```

Con:
```jsx
  async function handleDeleteLine(lineId) {
    try {
      await fetch(`/api/lineas/${lineId}`, { method: 'DELETE' });
      setLineas(prev => prev.filter(l => l.id !== lineId));
      showToast('Línea eliminada');
    } catch {
      showToast('Error al eliminar línea', 'error');
    }
  }
```

- [ ] **Step 6: Actualizar handleCancelDocument — quitar confirm(), añadir toast**

Reemplazar:
```jsx
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
```

Con:
```jsx
  async function handleCancelDocument() {
    try {
      const resp = await fetch(`/api/documentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'Cancelada' }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error);
      setDoc(prev => ({ ...prev, estado: 'Cancelada' }));
      showToast(`${doc.numero} cancelada`);
    } catch (e) {
      showToast(`Error: ${e.message}`, 'error');
    }
  }
```

- [ ] **Step 7: Añadir handler de Enter para nueva línea**

Añadir esta función antes del `return`:
```jsx
  function handleNewLineKeyDown(e) {
    if (e.key === 'Enter' && newLine.descripcion.trim() && !addingLine) {
      e.preventDefault();
      handleAddLine();
    }
  }
```

- [ ] **Step 8: Actualizar JSX — autoFocus en buscador, Enter en inputs, colores en filas**

En la tabla de líneas, cambiar el `<tr>` para reflejar el estado inline:
```jsx
                  <tr key={l.id} className={`border-b border-gray-100 transition-colors duration-300 ${
                    lineStatus[l.id] === 'ok' ? 'bg-green-50' :
                    lineStatus[l.id] === 'error' ? 'bg-red-50' : ''
                  }`}>
```

En el formulario de nueva línea, reemplazar `<BuscadorProducto onSelect={handleCatalogSelect} />` con:
```jsx
            <BuscadorProducto
              key={searchKey}
              onSelect={handleCatalogSelect}
              autoFocus={true}
            />
```

Añadir `onKeyDown={handleNewLineKeyDown}` a los cuatro inputs del formulario de nueva línea (SKU, Producto, Precio c/u, Cantidad, Descuento %):
```jsx
                className="w-full border border-gray-300 px-3 py-1.5 font-mono text-sm focus:outline-none focus:border-black bg-white"
                onKeyDown={handleNewLineKeyDown}
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/pages/EditarFactura.jsx
git commit -m "feat: EditarFactura — toasts, inline line feedback, autoFocus, Enter to add"
```
