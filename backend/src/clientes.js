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
