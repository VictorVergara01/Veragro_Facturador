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
