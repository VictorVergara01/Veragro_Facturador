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
    descuento, applyItbms, qrDataUrl, metodoPago,
  } = data;

  const hasLineDiscounts = lineas.some(l => (l.descuento ?? 0) > 0);

  const lineasRows = lineas.map((l, i) => {
    const lineDesc = l.descuento ?? 0;
    const lineTotal = l.cantidad * l.precio * (1 - lineDesc / 100);
    return `
    <tr>
      <td class="sku">${esc(l.sku || '—')}</td>
      <td>${esc(l.descripcion)}</td>
      <td class="tr">${l.cantidad}</td>
      <td class="tr">$${fmt(l.precio)}</td>
      ${hasLineDiscounts ? `<td class="tr">${lineDesc > 0 ? lineDesc + '%' : '—'}</td>` : ''}
      <td class="tr">$${fmt(lineTotal)}</td>
    </tr>`;
  }).join('');

  const descuentoRow = descuento > 0
    ? `<div class="trow"><span>Descuento global (${descuento}%)</span><span>-$${fmt(descuentoAmt)}</span></div>`
    : '';

  const itbmsRow = applyItbms
    ? `<div class="trow"><span>ITBMS (7%)</span><span>$${fmt(itbmsAmt)}</span></div>`
    : '';

  const descColTh = hasLineDiscounts
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

  const banco = process.env.EMPRESA_BANCO ?? 'Banco General';
  const tipoCuenta = process.env.EMPRESA_TIPO_CUENTA ?? 'Corriente';
  const cuenta = process.env.EMPRESA_CUENTA ?? '04-88-888888-8';
  const cuentaNombre = process.env.EMPRESA_CUENTA_NOMBRE ?? 'AgroTech Drones S.A.';
  const yappy = process.env.EMPRESA_YAPPY ?? '+507 6000-0000';
  const metodoPagoBlock = metodoPago
    ? `<div class="prow" style="margin-top:6px"><span class="pk">Método de pago:</span> ${esc(metodoPago)}</div>`
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
.sku{font-size:9px;color:#888;}
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
      <th style="width:90px">SKU</th>
      <th>Producto / Servicio</th>
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

async function generatePDF(html, formato = 'Letter') {
  const FORMATS = { A4: 'A4', Legal: 'Legal', Letter: 'Letter' };
  const paperFormat = FORMATS[formato] ?? 'Letter';

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: paperFormat,
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  return pdf;
}

module.exports = { buildHTML, generateQR, generatePDF };
