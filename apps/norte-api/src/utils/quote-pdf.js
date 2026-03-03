/**
 * Quote PDF Generator using PDFKit
 * Generates professional-looking quotes for Norte Piscinas orders
 */
const PDFDocument = require('pdfkit');

function generateQuotePDF(order, items, customer, settings = {}) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const buffers = [];

            doc.on('data', (chunk) => buffers.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);

            const storeName = settings.store_name || 'Norte Piscinas';
            const storePhone = settings.store_phone || '';
            const storeAddress = settings.store_address || '';

            // ── Header ──────────────────────────────────────────────────────────
            doc.fontSize(24).fillColor('#0EA5E9').text(storeName, { align: 'center' });
            doc.fontSize(10).fillColor('#666666').text('Produtos para Piscina', { align: 'center' });
            if (storePhone) doc.text(`Tel: ${storePhone}`, { align: 'center' });
            if (storeAddress) doc.text(storeAddress, { align: 'center' });
            doc.moveDown(1.5);

            // ── Divider ─────────────────────────────────────────────────────────
            doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#0EA5E9').lineWidth(2).stroke();
            doc.moveDown(1);

            // ── Quote Info ──────────────────────────────────────────────────────
            doc.fontSize(16).fillColor('#0F172A').text('ORÇAMENTO', { align: 'center' });
            doc.moveDown(0.5);

            doc.fontSize(10).fillColor('#333333');
            doc.text(`Nº: ${order.order_number}`, 50);
            doc.text(`Data: ${new Date(order.created_at).toLocaleDateString('pt-BR')}`, 50);
            doc.moveDown(0.5);

            // ── Customer Info ───────────────────────────────────────────────────
            doc.fontSize(12).fillColor('#0EA5E9').text('Cliente');
            doc.fontSize(10).fillColor('#333333');
            doc.text(`Nome: ${customer.name}`);
            doc.text(`Telefone: ${customer.phone}`);
            if (customer.email) doc.text(`Email: ${customer.email}`);
            if (customer.address_street) {
                doc.text(`Endereço: ${customer.address_street}, ${customer.address_number || 'S/N'} - ${customer.address_neighborhood || ''}`);
                doc.text(`${customer.address_city || ''} - ${customer.address_state || ''} | CEP: ${customer.address_zip || ''}`);
            }
            doc.moveDown(1);

            // ── Items Table ─────────────────────────────────────────────────────
            doc.fontSize(12).fillColor('#0EA5E9').text('Itens do Orçamento');
            doc.moveDown(0.5);

            // Table header
            const tableTop = doc.y;
            const col = { item: 50, qty: 320, price: 380, total: 470 };

            doc.fontSize(9).fillColor('#FFFFFF');
            doc.rect(50, tableTop, 495, 20).fill('#0EA5E9');
            doc.text('Produto', col.item + 5, tableTop + 5);
            doc.text('Qtd', col.qty + 5, tableTop + 5);
            doc.text('Unit.', col.price + 5, tableTop + 5);
            doc.text('Total', col.total + 5, tableTop + 5);

            let y = tableTop + 25;
            doc.fillColor('#333333');

            items.forEach((item, i) => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }

                const bg = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
                doc.rect(50, y - 3, 495, 18).fill(bg);
                doc.fillColor('#333333');
                doc.fontSize(9);
                doc.text(item.name.substring(0, 40), col.item + 5, y);
                doc.text(String(item.quantity), col.qty + 5, y);
                doc.text(formatCurrency(item.unit_price), col.price + 5, y);
                doc.text(formatCurrency(item.total), col.total + 5, y);
                y += 18;
            });

            y += 10;

            // ── Totals ──────────────────────────────────────────────────────────
            doc.moveTo(350, y).lineTo(545, y).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
            y += 10;

            doc.fontSize(10).fillColor('#333333');
            doc.text('Subtotal:', 350, y);
            doc.text(formatCurrency(order.subtotal), 470, y);
            y += 18;

            if (parseFloat(order.discount) > 0) {
                doc.fillColor('#22C55E');
                doc.text('Desconto:', 350, y);
                doc.text(`- ${formatCurrency(order.discount)}`, 470, y);
                y += 18;
                doc.fillColor('#333333');
            }

            if (parseFloat(order.delivery_fee) > 0) {
                doc.text('Frete:', 350, y);
                doc.text(formatCurrency(order.delivery_fee), 470, y);
                y += 18;
            }

            doc.moveTo(350, y).lineTo(545, y).strokeColor('#0EA5E9').lineWidth(1).stroke();
            y += 10;

            doc.fontSize(14).fillColor('#0EA5E9').font('Helvetica-Bold');
            doc.text('TOTAL:', 350, y);
            doc.text(formatCurrency(order.total), 460, y);
            y += 30;

            // ── Footer ──────────────────────────────────────────────────────────
            doc.font('Helvetica').fontSize(9).fillColor('#999999');
            doc.text('Este orçamento é válido por 7 dias.', 50, y, { align: 'center' });
            doc.text('Para confirmar o pedido, responda com "CONFIRMAR" via WhatsApp.', 50, y + 15, { align: 'center' });

            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

module.exports = { generateQuotePDF };
