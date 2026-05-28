require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createNotionClient, listDocuments, getDocument, createDocument } = require('./notion');
const { buildHTML, generateQR, generatePDF } = require('./pdf');
const { applyDiscountAndTax } = require('./calculateTotals');
const { listClientes } = require('./clientes');
const { searchInventario, createInventarioProduct } = require('./inventario');

const app = express();
app.use(cors());
app.use(express.json());

const notion = createNotionClient();

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/clientes', async (req, res) => {
  try {
    const clientes = await listClientes(notion);
    res.json(clientes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/inventario', async (req, res) => {
  try {
    const items = await searchInventario(notion, req.query.q || '');
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

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

app.post('/api/documentos', async (req, res) => {
  try {
    const { tipo, clienteId, fecha, notas } = req.body;
    if (!tipo || !clienteId || !fecha) {
      return res.status(400).json({ error: 'tipo, clienteId y fecha son requeridos' });
    }
    if (!['FAC', 'COT', 'SER'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser FAC, COT o SER' });
    }
    const result = await createDocument(notion, { tipo, clienteId, fecha, notas });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

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
