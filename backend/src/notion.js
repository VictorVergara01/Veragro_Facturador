const { Client } = require('@notionhq/client');

const TIPO_LABELS = {
  'Factura de Servicio': 'FACTURA DE SERVICIO',
  'Factura': 'FACTURA',
  'Cotización': 'COTIZACIÓN',
};

const TIPO_PREFIX = {
  'Factura de Servicio': 'SER',
  'Factura': 'FAC',
  'Cotización': 'COT',
};

const TIPO_SELECT = {
  FAC: 'Factura',
  COT: 'Cotización',
  SER: 'Factura de Servicio',
};

function createNotionClient() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

async function listDocuments(notion) {
  const resp = await notion.request({
    path: `databases/${process.env.NOTION_DB_VENTAS}/query`,
    method: 'post',
    body: { sorts: [{ property: 'Fecha', direction: 'descending' }] },
  });

  return Promise.all(resp.results.map(page => mapPageToSummary(notion, page)));
}

async function mapPageToSummary(notion, page) {
  const p = page.properties;
  const numero = getTitleText(p);
  const tipoSelect = p['Tipo']?.select?.name ?? '';
  const tipo = TIPO_PREFIX[tipoSelect] ?? numero.split('-')[0];

  const clienteId = p['Cliente']?.relation?.[0]?.id;
  const cliente = clienteId ? await getPageTitle(notion, clienteId) : '';

  return {
    id: page.id,
    numero,
    tipo,
    cliente,
    fecha: p['Fecha']?.date?.start ?? '',
    estado: p['Estado']?.select?.name ?? '',
  };
}

async function getDocument(notion, pageId) {
  const [page, lineas] = await Promise.all([
    notion.pages.retrieve({ page_id: pageId }),
    getLineItems(notion, pageId),
  ]);
  return mapPageToDocument(notion, page, lineas);
}

async function getLineItems(notion, pageId) {
  const blocks = await notion.blocks.children.list({ block_id: pageId });
  const dbBlock = blocks.results.find(b => b.type === 'child_database');
  if (!dbBlock) return [];

  const items = await notion.request({
    path: `databases/${dbBlock.id}/query`,
    method: 'post',
    body: {},
  });

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
      sku,
      descripcion,
      cantidad: p['Cantidad']?.number ?? 0,
      precio: p['Precio c/u']?.number ?? 0,
      descuento: p['Descuento %']?.number ?? 0,
    };
  });
}

async function mapPageToDocument(notion, page, lineas) {
  const p = page.properties;
  const numero = getTitleText(p);
  const tipoSelect = p['Tipo']?.select?.name ?? '';
  const tipo = TIPO_PREFIX[tipoSelect] ?? numero.split('-')[0];
  const tipoLabel = TIPO_LABELS[tipoSelect] ?? tipoSelect ?? tipo;

  const clienteId = p['Cliente']?.relation?.[0]?.id;
  const cliente = clienteId ? await getPageTitle(notion, clienteId) : '';

  const ordenId = p['Numero de Orden']?.relation?.[0]?.id;
  const referencia = ordenId ? await getPageTitle(notion, ordenId) : '';

  return {
    id: page.id,
    numero,
    tipo,
    tipoLabel,
    cliente,
    ruc: p['RUC']?.rich_text?.[0]?.plain_text ?? '',
    direccion: p['Dirección']?.rich_text?.[0]?.plain_text ?? '',
    telefono: p['Teléfono']?.phone_number ?? '',
    email: p['Email']?.email ?? '',
    fecha: p['Fecha']?.date?.start ?? '',
    vencimiento: p['Vencimiento']?.date?.start ?? '',
    estado: p['Estado']?.select?.name ?? '',
    notas: p['Notas']?.rich_text?.[0]?.plain_text ?? '',
    referencia,
    lineas,
  };
}

// --- helpers ---

function getTitleText(properties) {
  const titleProp = Object.values(properties).find(v => v.type === 'title');
  return titleProp?.title?.[0]?.plain_text ?? '';
}

async function getPageTitle(notion, pageId) {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    const titleProp = Object.values(page.properties).find(v => v.type === 'title');
    return titleProp?.title?.[0]?.plain_text ?? '';
  } catch {
    return '';
  }
}

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
  // 1. Get all existing numbers to compute next
  const resp = await notion.request({
    path: `databases/${process.env.NOTION_DB_VENTAS}/query`,
    method: 'post',
    body: { page_size: 100 },
  });
  const allNumbers = resp.results.map(p => getTitleText(p.properties));
  const numero = computeNextNumber(tipo, allNumbers);

  // 2. Create the page in Notion
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

  // 3. Create child database for line items
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

function computeNextNumber(prefix, allNumbers) {
  const nums = allNumbers
    .filter(n => n.startsWith(`${prefix}-`))
    .map(n => parseInt(n.split('-')[1], 10))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

module.exports = { createNotionClient, listDocuments, getDocument, computeNextNumber, createDocument };
