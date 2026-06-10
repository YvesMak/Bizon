// Génère un reçu PDF à la volée à partir d'une commande (articles + options +
// frais de livraison + paiement). Indépendant du système de factures.
const PDFDocument = require('pdfkit');

const TYPE_LABEL = { dine_in: 'Sur place', takeaway: 'À emporter', delivery: 'Livraison' };
const METHOD_LABEL = { mobile_money: 'Mobile Money', cash: 'Espèces', card: 'Carte bancaire' };

// Format monétaire sûr pour PDF (espace fine non gérée par Helvetica → espace simple).
function fcfa(n) {
  const v = Math.round(Number(n) || 0);
  return `${String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} FCFA`;
}

function fmtDate(d) {
  const dt = d ? new Date(d) : new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

/**
 * Écrit le reçu directement dans la réponse HTTP (stream).
 * @param {object} res  réponse Express
 * @param {{order, restaurant, payment}} data
 */
function streamReceipt(res, { order, restaurant, payment }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="recu-${order.order_number}.pdf"`);
  doc.pipe(res);

  const L = 50;            // marge gauche
  const R = 545;           // marge droite (A4 ≈ 595)

  // ---- En-tête : restaurant + REÇU ----
  doc.fillColor('#1c1917').font('Helvetica-Bold').fontSize(20).text(restaurant.name || 'Restaurant', L, 50);
  doc.font('Helvetica').fontSize(9).fillColor('#666');
  let hy = 76;
  if (restaurant.address) { doc.text(restaurant.address, L, hy); hy += 13; }
  if (restaurant.phone) { doc.text(restaurant.phone, L, hy); hy += 13; }

  doc.font('Helvetica-Bold').fontSize(20).fillColor('#C62828').text('REÇU', 350, 50, { width: R - 350, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor('#1c1917')
    .text(`N° ${order.order_number}`, 350, 78, { width: R - 350, align: 'right' })
    .text(fmtDate(order.created_at || order.createdAt), 350, 93, { width: R - 350, align: 'right' });

  // ---- Infos commande ----
  let y = Math.max(hy, 110) + 14;
  doc.moveTo(L, y).lineTo(R, y).strokeColor('#e5e0d8').stroke();
  y += 14;
  doc.font('Helvetica').fontSize(10).fillColor('#1c1917');
  const typeLabel = TYPE_LABEL[order.type] || order.type;
  let infoLine = typeLabel;
  if (order.type === 'dine_in' && order.table_number) infoLine += ` — Table ${order.table_number}`;
  doc.text(infoLine, L, y);
  if (order.customer_name) doc.text(`Client : ${order.customer_name}`, 300, y, { width: R - 300, align: 'right' });
  y += 16;
  if (order.type === 'delivery' && order.delivery_address) { doc.fillColor('#666').text(`Livraison : ${order.delivery_address}`, L, y); y += 16; }

  // ---- Tableau articles ----
  y += 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#666');
  doc.text('QTÉ', L, y); doc.text('ARTICLE', L + 40, y); doc.text('P.U.', 360, y, { width: 80, align: 'right' }); doc.text('TOTAL', 460, y, { width: R - 460, align: 'right' });
  y += 6; doc.moveTo(L, y + 8).lineTo(R, y + 8).strokeColor('#e5e0d8').stroke(); y += 16;

  doc.font('Helvetica').fontSize(10).fillColor('#1c1917');
  for (const it of (order.items || [])) {
    if (y > 740) { doc.addPage(); y = 50; }
    doc.font('Helvetica').fillColor('#1c1917');
    doc.text(`${it.quantity}×`, L, y, { width: 35 });
    doc.text(it.product_name || '', L + 40, y, { width: 300 });
    doc.text(fcfa(it.unit_price), 360, y, { width: 80, align: 'right' });
    doc.text(fcfa(it.subtotal), 460, y, { width: R - 460, align: 'right' });
    let lineH = 15;
    const opts = Array.isArray(it.options) && it.options.length ? it.options.map((o) => o.name).join(', ') : '';
    if (opts) { doc.font('Helvetica').fontSize(8).fillColor('#888').text(opts, L + 40, y + 13, { width: 300 }); lineH += 11; }
    if (it.notes) { doc.font('Helvetica-Oblique').fontSize(8).fillColor('#b07a2a').text(`Note : ${it.notes}`, L + 40, y + 13 + (opts ? 10 : 0), { width: 300 }); lineH += 11; }
    doc.fontSize(10);
    y += lineH;
  }

  // ---- Totaux ----
  y += 8; doc.moveTo(330, y).lineTo(R, y).strokeColor('#e5e0d8').stroke(); y += 12;
  const totalRow = (label, value, opts = {}) => {
    doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(opts.bold ? 12 : 10).fillColor(opts.color || '#1c1917');
    doc.text(label, 330, y, { width: 110 });
    doc.text(value, 440, y, { width: R - 440, align: 'right' });
    y += opts.bold ? 22 : 16;
  };
  const subtotal = Number(order.subtotal) || 0;
  const discount = Number(order.discount_amount) || 0;
  const delivery = Number(order.delivery_fee) || 0;
  totalRow('Sous-total', fcfa(subtotal));
  if (discount > 0) totalRow('Réduction', `- ${fcfa(discount)}`, { color: '#2e7d32' });
  if (delivery > 0) totalRow('Frais de livraison', fcfa(delivery));
  totalRow('TOTAL', fcfa(order.total_amount), { bold: true });

  // ---- Paiement ----
  y += 8;
  if (payment) {
    const paid = payment.status === 'completed';
    doc.font('Helvetica').fontSize(10).fillColor('#1c1917')
      .text(`Paiement : ${METHOD_LABEL[payment.method] || payment.method} — ${paid ? 'Payé' : 'En attente'}`, L, y);
    y += 16;
  }

  // ---- Pied (juste après le contenu, pour éviter une page superflue) ----
  y += 12;
  doc.font('Helvetica').fontSize(9).fillColor('#999').text('Merci de votre visite !', L, y, { width: R - L, align: 'center' });

  doc.end();
}

module.exports = { streamReceipt };
