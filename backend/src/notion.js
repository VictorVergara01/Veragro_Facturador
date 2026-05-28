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
