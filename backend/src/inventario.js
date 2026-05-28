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
    const sku = p['SKU_EXT']?.rich_text?.[0]?.plain_text ?? '';
    const precio = p['Precio']?.number ?? 0;
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
  if (sku) props['SKU_EXT'] = { rich_text: [{ text: { content: sku } }] };
  if (precio) props['Precio'] = { number: precio };

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
