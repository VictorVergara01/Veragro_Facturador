# AgroTech Drones Facturador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack web invoicing system for AgroTech Drones — React/Vite frontend + Node/Express backend — that pulls documents (FAC/COT/SER) from a Notion database, generates professional PDF invoices with QR verification codes, and deploys via Docker.

**Architecture:** Express backend exposes a REST API that wraps the Notion SDK and uses Puppeteer to render HTML→PDF on demand. React/Vite frontend has three routes: document list (`/`), document preview with PDF options (`/factura/:id`), and a mobile-first public verification page (`/verify/:codigo`). In dev, Vite proxies `/api/*` to the Express server. In production, docker-compose runs both services with nginx proxying `/api/*` to the backend.

**Tech Stack:** Node.js 20, Express 4.18, @notionhq/client 2.x, Puppeteer 21.x, qrcode 1.5.x, Jest 29, React 18, Vite 5, Tailwind CSS 3, react-router-dom 6, Docker, docker-compose

---

## Assumed Notion Database Schema

One database (`NOTION_DB_VENTAS`). No second database required.

**Page properties:**
| Property | Notion type | Notes |
|---|---|---|
| `Número` | title | FAC-001, COT-002, SER-003 |
| `Cliente` | rich_text | Client name |
| `RUC` | rich_text | Client tax ID |
| `Dirección` | rich_text | Client address |
| `Teléfono` | phone_number | Client phone |
| `Email` | email | Client email |
| `Fecha` | date | Issue date |
| `Vencimiento` | date | Due date (optional) |
| `Estado` | select | Borrador / Enviada / Pagada / Cancelada |
| `Notas` | rich_text | Footer notes (optional) |
| `Referencia` | rich_text | Work order ref, SER- only |

**Page body:** Each page must contain a Notion **Table** block with these columns in order: `Descripción` | `Cantidad` | `Precio Unitario`. The first row is the header (skipped by the parser). If your schema differs, update property name strings in `backend/src/notion.js`.

---

## File Structure

```
agrotech-facturador/
├── .env.example
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js              # Express app + all route handlers
│       ├── notion.js              # Notion SDK: listDocuments(), getDocument()
│       ├── calculateTotals.js     # Pure fn: applyDiscountAndTax(lineas, desc, itbms)
│       ├── pdf.js                 # buildHTML(data), generateQR(url), generatePDF(html)
│       └── __tests__/
│           ├── calculateTotals.test.js
│           └── pdf.test.js
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── index.css
        ├── main.jsx
        ├── App.jsx
        ├── pages/
        │   ├── Lista.jsx
        │   ├── Factura.jsx
        │   └── Verify.jsx
        └── components/
            ├── TablaLineas.jsx
            └── Totales.jsx
```

---

### Task 1: Project scaffold

**Files:**
- Create: `.gitignore`
- Create: `.env.example`

- [ ] **Step 1: Create root .gitignore**

```
node_modules/
.env
dist/
.DS_Store
```

Save to `agrotech-facturador/.gitignore`.

- [ ] **Step 2: Create .env.example**

```
NOTION_TOKEN=secret_...
NOTION_DB_VENTAS=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PORT=3000
FRONTEND_URL=http://localhost:5173
```

Save to `agrotech-facturador/.env.example`. Copy to `.env` and fill in real values before running.

- [ ] **Step 3: Create working .env**

Copy `.env.example` to `.env` and fill in:
- `NOTION_TOKEN`: your Notion integration token (from notion.so/my-integrations)
- `NOTION_DB_VENTAS`: the database ID from the Notion DB URL (the 32-char hex segment)

- [ ] **Step 4: Commit**

```bash
git init
git add .gitignore .env.example
git commit -m "feat: project scaffold"
```

---

### Task 2: Backend Express skeleton

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/server.js`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "agrotech-backend",
  "version": "1.0.0",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "jest --runInBand"
  },
  "jest": {
    "testEnvironment": "node"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.3",
    "puppeteer": "^21.11.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create backend/src/server.js (skeleton only)**

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 4: Verify health endpoint**

```bash
cd backend && node src/server.js &
curl http://localhost:3000/health
```

Expected: `{"ok":true}`

Kill the background process: `kill %1`

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: backend Express skeleton with health check"
```

---

### Task 3: calculateTotals.js (TDD)

**Files:**
- Create: `backend/src/calculateTotals.js`
- Create: `backend/src/__tests__/calculateTotals.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `backend/src/__tests__/calculateTotals.test.js`:

```js
const { applyDiscountAndTax } = require('../calculateTotals');

const lineas = [
  { cantidad: 2, precio: 100 },
  { cantidad: 1, precio: 50 },
];
// subtotalBruto = 250

describe('applyDiscountAndTax', () => {
  test('no discount, no itbms', () => {
    const r = applyDiscountAndTax(lineas, 0, false);
    expect(r.subtotalBruto).toBe(250);
    expect(r.descuentoAmt).toBe(0);
    expect(r.subtotal).toBe(250);
    expect(r.itbmsAmt).toBe(0);
    expect(r.total).toBe(250);
  });

  test('10% discount, no itbms', () => {
    const r = applyDiscountAndTax(lineas, 10, false);
    expect(r.descuentoAmt).toBe(25);
    expect(r.subtotal).toBe(225);
    expect(r.total).toBe(225);
  });

  test('no discount, with itbms 7%', () => {
    const r = applyDiscountAndTax(lineas, 0, true);
    expect(r.itbmsAmt).toBe(17.5);
    expect(r.total).toBe(267.5);
  });

  test('10% discount + itbms applied after discount', () => {
    const r = applyDiscountAndTax(lineas, 10, true);
    expect(r.subtotal).toBe(225);
    expect(r.itbmsAmt).toBe(15.75);
    expect(r.total).toBe(240.75);
  });

  test('empty lineas returns all zeros', () => {
    const r = applyDiscountAndTax([], 0, false);
    expect(r.total).toBe(0);
  });

  test('rounding: 1/3 price does not accumulate float error', () => {
    const r = applyDiscountAndTax([{ cantidad: 3, precio: 0.1 }], 0, false);
    expect(r.total).toBe(0.3);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test
```

Expected: `FAIL` — `Cannot find module '../calculateTotals'`

- [ ] **Step 3: Implement calculateTotals.js**

Create `backend/src/calculateTotals.js`:

```js
function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyDiscountAndTax(lineas, descuento = 0, applyItbms = false) {
  const subtotalBruto = round2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
  const descuentoAmt = round2(subtotalBruto * (descuento / 100));
  const subtotal = round2(subtotalBruto - descuentoAmt);
  const itbmsAmt = applyItbms ? round2(subtotal * 0.07) : 0;
  const total = round2(subtotal + itbmsAmt);
  return { subtotalBruto, descuentoAmt, subtotal, itbmsAmt, total };
}

module.exports = { applyDiscountAndTax };
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npm test
```

Expected: `PASS backend/src/__tests__/calculateTotals.test.js` — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add backend/src/calculateTotals.js backend/src/__tests__/calculateTotals.test.js
git commit -m "feat: calculateTotals with TDD — discount + ITBMS logic"
```

---

### Task 4: notion.js

**Files:**
- Create: `backend/src/notion.js`

- [ ] **Step 1: Create backend/src/notion.js**

```js
const { Client } = require('@notionhq/client');

const TIPO_LABELS = {
  FAC: 'FACTURA',
  COT: 'COTIZACIÓN',
  SER: 'FACTURA DE SERVICIO',
};

function createNotionClient() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

async function listDocuments(notion) {
  const resp = await notion.databases.query({
    database_id: process.env.NOTION_DB_VENTAS,
    sorts: [{ property: 'Fecha', direction: 'descending' }],
  });
  return resp.results.map(mapPageToSummary);
}

function mapPageToSummary(page) {
  const p = page.properties;
  const numero = p['Número']?.title?.[0]?.plain_text ?? '';
  const tipo = numero.split('-')[0];
  return {
    id: page.id,
    numero,
    tipo,
    cliente: p['Cliente']?.rich_text?.[0]?.plain_text ?? '',
    fecha: p['Fecha']?.date?.start ?? '',
    estado: p['Estado']?.select?.name ?? '',
  };
}

async function getDocument(notion, pageId) {
  const [page, lineas] = await Promise.all([
    notion.pages.retrieve({ page_id: pageId }),
    getLineItems(notion, pageId),
  ]);
  return mapPageToDocument(page, lineas);
}

async function getLineItems(notion, pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  const tableBlock = blocks.results.find(b => b.type === 'table');
  if (!tableBlock) return [];

  const rows = await notion.blocks.children.list({ block_id: tableBlock.id });
  const dataRows = rows.results
    .filter(b => b.type === 'table_row')
    .slice(1); // skip header row

  return dataRows.map(row => {
    const cells = row.table_row.cells;
    return {
      descripcion: cells[0]?.[0]?.plain_text ?? '',
      cantidad: parseFloat(cells[1]?.[0]?.plain_text ?? '0') || 0,
      precio: parseFloat(cells[2]?.[0]?.plain_text ?? '0') || 0,
    };
  });
}

function mapPageToDocument(page, lineas) {
  const p = page.properties;
  const numero = p['Número']?.title?.[0]?.plain_text ?? '';
  const tipo = numero.split('-')[0];
  return {
    id: page.id,
    numero,
    tipo,
    tipoLabel: TIPO_LABELS[tipo] ?? tipo,
    cliente: p['Cliente']?.rich_text?.[0]?.plain_text ?? '',
    ruc: p['RUC']?.rich_text?.[0]?.plain_text ?? '',
    direccion: p['Dirección']?.rich_text?.[0]?.plain_text ?? '',
    telefono: p['Teléfono']?.phone_number ?? '',
    email: p['Email']?.email ?? '',
    fecha: p['Fecha']?.date?.start ?? '',
    vencimiento: p['Vencimiento']?.date?.start ?? '',
    estado: p['Estado']?.select?.name ?? '',
    notas: p['Notas']?.rich_text?.[0]?.plain_text ?? '',
    referencia: p['Referencia']?.rich_text?.[0]?.plain_text ?? '',
    lineas,
  };
}

module.exports = { createNotionClient, listDocuments, getDocument };
```

- [ ] **Step 2: Verify module loads without error**

```bash
cd backend && node -e "require('./src/notion'); console.log('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/src/notion.js
git commit -m "feat: Notion SDK wrapper — listDocuments, getDocument, table line items"
```

---

### Task 5: pdf.js — buildHTML()

**Files:**
- Create: `backend/src/pdf.js` (buildHTML only — no Puppeteer yet)
- Create: `backend/src/__tests__/pdf.test.js`

- [ ] **Step 1: Write failing tests for buildHTML**

Create `backend/src/__tests__/pdf.test.js`:

```js
const { buildHTML } = require('../pdf');

const base = {
  numero: 'FAC-2024-001',
  tipoLabel: 'FACTURA',
  cliente: 'Test Cliente',
  ruc: '8-888-8888',
  direccion: 'Panama City',
  telefono: '+507 6000-0000',
  email: 'test@test.com',
  fecha: '2024-01-15',
  vencimiento: '',
  estado: 'Enviada',
  notas: '',
  referencia: '',
  lineas: [{ descripcion: 'Drone survey', cantidad: 1, precio: 500 }],
  subtotalBruto: 500,
  descuentoAmt: 0,
  subtotal: 500,
  itbmsAmt: 0,
  total: 500,
  descuento: 0,
  applyItbms: false,
  qrDataUrl: 'data:image/png;base64,abc123',
};

test('contains document type label', () => {
  expect(buildHTML(base)).toContain('FACTURA');
});

test('contains client name', () => {
  expect(buildHTML(base)).toContain('Test Cliente');
});

test('contains document number', () => {
  expect(buildHTML(base)).toContain('FAC-2024-001');
});

test('embeds QR data URL', () => {
  expect(buildHTML(base)).toContain('data:image/png;base64,abc123');
});

test('no ITBMS row when applyItbms false', () => {
  expect(buildHTML(base)).not.toContain('ITBMS');
});

test('ITBMS row present when applyItbms true', () => {
  const html = buildHTML({ ...base, applyItbms: true, itbmsAmt: 35, total: 535 });
  expect(html).toContain('ITBMS');
});

test('discount row present when descuento > 0', () => {
  const html = buildHTML({ ...base, descuento: 10, descuentoAmt: 50, subtotal: 450, total: 450 });
  expect(html).toContain('Descuento');
  expect(html).toContain('10%');
});

test('escapes HTML in client name', () => {
  const html = buildHTML({ ...base, cliente: '<script>xss</script>' });
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
});

test('referencia section shown when referencia set', () => {
  const html = buildHTML({ ...base, referencia: 'OT-2024-005' });
  expect(html).toContain('OT-2024-005');
});
```

- [ ] **Step 2: Run to confirm FAIL**

```bash
cd backend && npm test -- pdf.test.js
```

Expected: `FAIL` — `Cannot find module '../pdf'`

- [ ] **Step 3: Create backend/src/pdf.js with buildHTML**

```js
const puppeteer = require('puppeteer');
const QRCode = require('qrcode');

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n) {
  return Number(n).toFixed(2);
}

function buildHTML(data) {
  const {
    numero, tipoLabel, cliente, ruc, direccion, telefono, email,
    fecha, estado, notas, referencia,
    lineas, subtotalBruto, descuentoAmt, itbmsAmt, total,
    descuento, applyItbms, qrDataUrl,
  } = data;

  const lineasRows = lineas.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(l.descripcion)}</td>
      <td class="tr">${l.cantidad}</td>
      <td class="tr">$${fmt(l.precio)}</td>
      ${descuento > 0 ? `<td class="tr">${descuento}%</td>` : ''}
      <td class="tr">$${fmt(l.cantidad * l.precio)}</td>
    </tr>`).join('');

  const descuentoRow = descuento > 0
    ? `<div class="trow"><span>Descuento (${descuento}%)</span><span>-$${fmt(descuentoAmt)}</span></div>`
    : '';

  const itbmsRow = applyItbms
    ? `<div class="trow"><span>ITBMS (7%)</span><span>$${fmt(itbmsAmt)}</span></div>`
    : '';

  const descColTh = descuento > 0
    ? '<th class="tr" style="width:60px">Desc.</th>'
    : '';

  const referenciaBlock = referencia
    ? `<div>
         <div class="slabel">Referencia / Orden de Trabajo</div>
         <div>${esc(referencia)}</div>
       </div>`
    : '';

  const notasBlock = notas
    ? `<p style="margin-top:10px;font-style:italic">${esc(notas)}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier Prime','Courier New',monospace;background:#fff;color:#000;padding:45px 55px;font-size:12px;line-height:1.5}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px}
.agro{font-size:32px;font-weight:700;letter-spacing:2px;color:#000}
.tech{font-size:32px;font-weight:700;letter-spacing:2px;color:#c8f060}
.sub{font-size:10px;letter-spacing:5px;color:#666;margin-top:2px}
.dtype{font-size:26px;font-weight:700;color:#c8371a;letter-spacing:3px}
hr{border:none;border-top:1px solid #000;margin:18px 0}
.mgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:16px}
.mlabel{font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px;color:#555}
.mval{font-size:13px}
.mtotal{font-size:20px;font-weight:700}
.cgrid{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-bottom:16px}
.slabel{font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#555}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
th{font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;padding:8px 6px;border-bottom:2px solid #000;text-align:left}
td{padding:6px;border-bottom:1px solid #e8e8e8;font-size:11px}
.tr{text-align:right}
.twrap{display:flex;justify-content:flex-end;margin-bottom:16px}
.tbox{width:280px}
.trow{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}
.ttotal{display:flex;justify-content:space-between;border-top:2px solid #000;padding-top:8px;margin-top:4px;font-size:15px;font-weight:700}
.pqr{display:flex;justify-content:space-between;align-items:flex-end}
.plabel{font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.prow{font-size:11px;margin-bottom:3px}
.pk{font-weight:700}
.qrimg{width:100px;height:100px}
.qrcap{font-size:8px;color:#999;text-align:center;margin-top:3px}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:50px}
.sigline{border-top:1px solid #000;padding-top:6px;margin-top:50px;font-size:11px}
.sigsub{color:#777;font-size:10px;margin-top:2px}
</style>
</head>
<body>

<div class="hdr">
  <div>
    <div><span class="agro">AGRO</span><span class="tech">TECH</span></div>
    <div class="sub">DRONES</div>
  </div>
  <div class="dtype">${esc(tipoLabel)}</div>
</div>

<hr>

<div class="mgrid">
  <div>
    <div class="mlabel">Monto Total</div>
    <div class="mval mtotal">$${fmt(total)}</div>
  </div>
  <div>
    <div class="mlabel">Fecha</div>
    <div class="mval">${esc(fecha) || '—'}</div>
  </div>
  <div>
    <div class="mlabel">Número</div>
    <div class="mval">${esc(numero)}</div>
  </div>
  <div>
    <div class="mlabel">Estado</div>
    <div class="mval">${esc(estado)}</div>
  </div>
</div>

<hr>

<div class="cgrid">
  <div>
    <div class="slabel">Facturado a</div>
    <div style="font-weight:700">${esc(cliente)}</div>
    ${ruc ? `<div>RUC: ${esc(ruc)}</div>` : ''}
    ${direccion ? `<div>${esc(direccion)}</div>` : ''}
    ${telefono ? `<div>Tel: ${esc(telefono)}</div>` : ''}
    ${email ? `<div>${esc(email)}</div>` : ''}
  </div>
  ${referenciaBlock}
</div>

<hr>

<table>
  <thead>
    <tr>
      <th style="width:28px">#</th>
      <th>Descripción / Servicio</th>
      <th class="tr" style="width:55px">Cant.</th>
      <th class="tr" style="width:90px">Precio Unit.</th>
      ${descColTh}
      <th class="tr" style="width:90px">Total</th>
    </tr>
  </thead>
  <tbody>${lineasRows}</tbody>
</table>

<div class="twrap">
  <div class="tbox">
    <div class="trow"><span>Subtotal</span><span>$${fmt(subtotalBruto)}</span></div>
    ${descuentoRow}
    ${itbmsRow}
    <div class="ttotal"><span>TOTAL</span><span>$${fmt(total)}</span></div>
  </div>
</div>

<hr>

<div class="pqr">
  <div>
    <div class="plabel">Información de Pago</div>
    <div class="prow"><span class="pk">Banco General</span></div>
    <div class="prow">Cuenta Corriente: 04-88-888888-8</div>
    <div class="prow">A nombre de: AgroTech Drones S.A.</div>
    <div class="prow" style="margin-top:6px"><span class="pk">Yappy:</span> +507 6000-0000</div>
    ${notasBlock}
  </div>
  <div>
    <img class="qrimg" src="${qrDataUrl}" alt="QR Verificación">
    <div class="qrcap">Escanea para verificar</div>
  </div>
</div>

<hr>

<div class="sigs">
  <div>
    <div class="sigline">
      <div style="font-weight:700">Aceptado por</div>
      <div class="sigsub">${esc(cliente)}</div>
    </div>
  </div>
  <div>
    <div class="sigline">
      <div style="font-weight:700">Firma autorizada</div>
      <div class="sigsub">AgroTech Drones</div>
    </div>
  </div>
</div>

</body>
</html>`;
}

async function generateQR(url) {
  return QRCode.toDataURL(url, { width: 200, margin: 1 });
}

async function generatePDF(html) {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  return pdf;
}

module.exports = { buildHTML, generateQR, generatePDF };
```

- [ ] **Step 4: Run pdf tests to confirm they pass**

```bash
cd backend && npm test -- pdf.test.js
```

Expected: `PASS` — 9 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
cd backend && npm test
```

Expected: All 15 tests pass (6 calculateTotals + 9 pdf).

- [ ] **Step 6: Commit**

```bash
git add backend/src/pdf.js backend/src/__tests__/pdf.test.js
git commit -m "feat: buildHTML PDF template + generateQR + generatePDF (Puppeteer)"
```

---

### Task 6: server.js — add all API routes

**Files:**
- Modify: `backend/src/server.js`

- [ ] **Step 1: Replace backend/src/server.js with full version**

```js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createNotionClient, listDocuments, getDocument } = require('./notion');
const { buildHTML, generateQR, generatePDF } = require('./pdf');
const { applyDiscountAndTax } = require('./calculateTotals');

const app = express();
app.use(cors());
app.use(express.json());

const notion = createNotionClient();

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/documentos', async (req, res) => {
  try {
    const docs = await listDocuments(notion);
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documentos/:id', async (req, res) => {
  try {
    const doc = await getDocument(notion, req.params.id);
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/pdf', async (req, res) => {
  try {
    const { notionId, descuento = 0, itbms = false } = req.body;
    const doc = await getDocument(notion, notionId);
    const totals = applyDiscountAndTax(doc.lineas, descuento, itbms);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify/${encodeURIComponent(doc.numero)}`;
    const qrDataUrl = await generateQR(verifyUrl);

    const html = buildHTML({ ...doc, ...totals, descuento, applyItbms: itbms, qrDataUrl });
    const pdfBuffer = await generatePDF(html);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `attachment; filename="${doc.numero}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Backend on port ${PORT}`));
}

module.exports = app;
```

- [ ] **Step 2: Smoke-test the list endpoint (requires valid .env)**

```bash
cd backend && node src/server.js &
curl http://localhost:3000/api/documentos
```

Expected: JSON array of documents from Notion (may be empty `[]` if DB is empty).

Kill: `kill %1`

- [ ] **Step 3: Commit**

```bash
git add backend/src/server.js
git commit -m "feat: backend routes — list, single document, PDF generation"
```

---

### Task 7: Frontend config files

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.js`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/postcss.config.js`
- Create: `frontend/index.html`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "agrotech-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.39",
    "tailwindcss": "^3.4.6",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Install frontend dependencies**

```bash
cd frontend && npm install
```

- [ ] **Step 3: Create frontend/vite.config.js**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
```

- [ ] **Step 4: Create frontend/tailwind.config.js**

```js
export default {
  content: ['./index.html', './src/**/*.{jsx,js}'],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Step 5: Create frontend/postcss.config.js**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: Create frontend/index.html**

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AgroTech Drones — Facturador</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: frontend config — Vite, Tailwind, React setup"
```

---

### Task 8: Frontend entry files

**Files:**
- Create: `frontend/src/index.css`
- Create: `frontend/src/main.jsx`
- Create: `frontend/src/App.jsx`

- [ ] **Step 1: Create frontend/src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: 'Courier Prime', 'Courier New', monospace;
}
```

- [ ] **Step 2: Create frontend/src/main.jsx**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 3: Create frontend/src/App.jsx**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Lista from './pages/Lista';
import Factura from './pages/Factura';
import Verify from './pages/Verify';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Lista />} />
        <Route path="/factura/:id" element={<Factura />} />
        <Route path="/verify/:codigo" element={<Verify />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 4: Verify dev server starts**

Start backend in one terminal: `cd backend && npm run dev`

Start frontend in another: `cd frontend && npm run dev`

Open `http://localhost:5173` — expect a blank page (no pages implemented yet) with no console errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: frontend entry — main.jsx, App.jsx, router, Tailwind CSS"
```

---

### Task 9: Lista.jsx

**Files:**
- Create: `frontend/src/pages/Lista.jsx`

- [ ] **Step 1: Create frontend/src/pages/Lista.jsx**

```jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const TIPO_STYLE = {
  FAC: { label: 'Factura', color: '#c8371a' },
  COT: { label: 'Cotización', color: '#1a5cc8' },
  SER: { label: 'Servicio', color: '#2a7a2a' },
};

export default function Lista() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/documentos')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setDocs)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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

        <div className="border-b-2 border-black pb-2 mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Documentos — {docs.length} registros
          </h2>
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
                    <td className="py-2.5 text-xs text-gray-500">{doc.estado || '—'}</td>
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
```

- [ ] **Step 2: Verify in browser**

With backend and frontend running, open `http://localhost:5173`. The document list should load with data from Notion.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Lista.jsx
git commit -m "feat: Lista page — document list from Notion"
```

---

### Task 10: TablaLineas.jsx + Totales.jsx

**Files:**
- Create: `frontend/src/components/TablaLineas.jsx`
- Create: `frontend/src/components/Totales.jsx`

- [ ] **Step 1: Create frontend/src/components/TablaLineas.jsx**

```jsx
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
```

- [ ] **Step 2: Create frontend/src/components/Totales.jsx**

```jsx
function round2(n) {
  return Math.round(n * 100) / 100;
}

export default function Totales({ lineas, descuento = 0, itbms = false }) {
  const subtotalBruto = round2(lineas.reduce((s, l) => s + l.cantidad * l.precio, 0));
  const descuentoAmt = round2(subtotalBruto * (descuento / 100));
  const subtotal = round2(subtotalBruto - descuentoAmt);
  const itbmsAmt = itbms ? round2(subtotal * 0.07) : 0;
  const total = round2(subtotal + itbmsAmt);

  return (
    <div className="flex justify-end mb-4">
      <div className="w-64 text-sm">
        <div className="flex justify-between py-1 border-b border-gray-100">
          <span className="text-gray-600">Subtotal</span>
          <span>${subtotalBruto.toFixed(2)}</span>
        </div>
        {descuento > 0 && (
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">Descuento ({descuento}%)</span>
            <span>-${descuentoAmt.toFixed(2)}</span>
          </div>
        )}
        {itbms && (
          <div className="flex justify-between py-1 border-b border-gray-100">
            <span className="text-gray-600">ITBMS (7%)</span>
            <span>${itbmsAmt.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 mt-1 border-t-2 border-black font-bold text-base">
          <span>TOTAL</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/
git commit -m "feat: TablaLineas + Totales components"
```

---

### Task 11: Factura.jsx

**Files:**
- Create: `frontend/src/pages/Factura.jsx`

- [ ] **Step 1: Create frontend/src/pages/Factura.jsx**

```jsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import TablaLineas from '../components/TablaLineas';
import Totales from '../components/Totales';

export default function Factura() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [descuento, setDescuento] = useState(0);
  const [itbms, setItbms] = useState(false);
  const [generating, setGenerating] = useState(false);

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
      const resp = await fetch('/api/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notionId: id, descuento, itbms }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Error generando PDF');
      }
      const blob = await resp.blob();
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
            { label: 'Monto Total', value: `$${doc.lineas.reduce((s,l)=>s+l.cantidad*l.precio,0).toFixed(2)}`, bold: true },
            { label: 'Fecha', value: doc.fecha || '—' },
            { label: 'Número', value: doc.numero, bold: true },
            { label: 'Estado', value: doc.estado || '—' },
          ].map(({ label, value, bold }) => (
            <div key={label}>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">{label}</div>
              <div className={bold ? 'font-bold text-lg' : 'text-sm'}>{value}</div>
            </div>
          ))}
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
```

- [ ] **Step 2: Verify in browser**

Navigate to a document from the Lista page. Confirm:
- Header, meta, client section render correctly
- Line items table shows with correct numbers
- Totals update live when toggling ITBMS or changing discount
- "Descargar PDF" button downloads a PDF

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Factura.jsx
git commit -m "feat: Factura page — preview, discount/ITBMS options, PDF download"
```

---

### Task 12: Verify.jsx

**Files:**
- Create: `frontend/src/pages/Verify.jsx`

- [ ] **Step 1: Create frontend/src/pages/Verify.jsx**

```jsx
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

  const subtotal = doc.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0);

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

        {/* Details grid */}
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
                <span>${(l.cantidad * l.precio).toFixed(2)}</span>
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
```

- [ ] **Step 2: Test QR verification flow**

1. Generate a PDF for any document from the Factura page
2. Scan the QR code in the PDF with a phone
3. Confirm the Verify page loads correctly on mobile and shows the right document details

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Verify.jsx
git commit -m "feat: Verify page — public mobile-first QR verification"
```

---

### Task 13: Dockerfiles + nginx

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`

- [ ] **Step 1: Create backend/Dockerfile**

```dockerfile
FROM node:20-slim

# Chromium for Puppeteer (lighter than full Puppeteer browser download)
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app
COPY package.json .
RUN npm install --production
COPY src/ ./src/

EXPOSE 3000
CMD ["node", "src/server.js"]
```

- [ ] **Step 2: Create frontend/nginx.conf**

```nginx
server {
    listen 80;

    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 3: Create frontend/Dockerfile**

```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf
git commit -m "feat: Dockerfiles — backend with Chromium, frontend with nginx proxy"
```

---

### Task 14: docker-compose.yml + full deploy test

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml in project root**

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    env_file: .env
    environment:
      - PORT=3000
      - FRONTEND_URL=http://localhost
    expose:
      - "3000"
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
```

- [ ] **Step 2: Build and start with docker-compose**

```bash
docker-compose up --build
```

Expected output ends with nginx starting and no errors.

- [ ] **Step 3: Verify full stack**

Open `http://localhost` — document list should load. Open a document, download a PDF, scan the QR with a phone.

- [ ] **Step 4: Verify PDF QR points to correct URL**

In production docker-compose, update `.env` to set `FRONTEND_URL=http://your-server-ip` so the QR URL resolves correctly for external scans.

- [ ] **Step 5: Final commit**

```bash
git add docker-compose.yml
git commit -m "feat: docker-compose — full stack deploy"
```

---

## Summary of API Contract

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ ok: true }` |
| GET | `/api/documentos` | — | `Array<{ id, numero, tipo, cliente, fecha, estado }>` |
| GET | `/api/documentos/:id` | — | Full document with `lineas[]` |
| POST | `/api/pdf` | `{ notionId, descuento?, itbms? }` | `application/pdf` binary |

## Post-deploy Customization

After the system is running, update these values in `backend/src/pdf.js` to match AgroTech Drones' real payment info:
- Line ~105: Bank account number
- Line ~107: Account name
- Line ~108: Yappy phone number
