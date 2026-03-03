const { Router } = require('express');
const QRCode = require('qrcode');
const router = Router();
const asaas = require('../services/asaas');

// ── PIX Payment ─────────────────────────────────────────────────────────────

// POST /payments/pix — Generate PIX QR Code (via Asaas)
router.post('/pix', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { order_id } = req.body;

        const orderResult = await pool.query(
            `SELECT o.*, c.name, c.email, c.phone, c.document, c.address_zip, c.address_number, c.address_street
             FROM orders o 
             JOIN customers c ON o.customer_id = c.id 
             WHERE o.id = $1`,
            [order_id]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderResult.rows[0];

        const asaasPayment = await asaas.createPayment({
            billingType: 'PIX',
            amount: parseFloat(order.total),
            orderNumber: order.order_number,
            customer: order,
            description: `Pedido ${order.order_number} - Norte Piscinas`
        });

        const pixDetails = await asaas.getPixQrCode(asaasPayment.id);

        const paymentResult = await pool.query(
            `INSERT INTO payments (order_id, method, amount, status, transaction_id, pix_qr_code, pix_copy_paste, provider_response, expires_at)
             VALUES ($1, 'pix_asaas', $2, 'pending', $3, $4, $5, $6, $7)
             ON CONFLICT (order_id) DO UPDATE SET
                method = EXCLUDED.method,
                amount = EXCLUDED.amount,
                status = EXCLUDED.status,
                transaction_id = EXCLUDED.transaction_id,
                pix_qr_code = EXCLUDED.pix_qr_code,
                pix_copy_paste = EXCLUDED.pix_copy_paste,
                provider_response = EXCLUDED.provider_response,
                expires_at = EXCLUDED.expires_at
             RETURNING *`,
            [
                order_id,
                order.total,
                asaasPayment.id,
                `data:image/png;base64,${pixDetails.encodedImage}`,
                pixDetails.payload,
                JSON.stringify(asaasPayment),
                asaasPayment.dueDate
            ]
        );

        await pool.query(
            "UPDATE orders SET status = 'awaiting_payment', payment_method = 'pix_asaas' WHERE id = $1",
            [order_id]
        );

        res.status(201).json({
            data: {
                payment: paymentResult.rows[0],
                pix_copy_paste: pixDetails.payload,
                qr_code: `data:image/png;base64,${pixDetails.encodedImage}`,
                order_number: order.order_number,
                amount: order.total
            }
        });
    } catch (err) {
        console.error('Error generating Asaas PIX:', err);
        res.status(500).json({ error: err.message || 'Failed to generate PIX' });
    }
});

// ── Asaas Credit Card ────────────────────────────────────────────────────────

// POST /payments/card — Process Credit Card via Asaas
router.post('/card', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { order_id, card, installments } = req.body;

        const orderResult = await pool.query(
            `SELECT o.*, c.name, c.email, c.phone, c.document, c.address_zip, c.address_number, c.address_street
             FROM orders o 
             JOIN customers c ON o.customer_id = c.id 
             WHERE o.id = $1`,
            [order_id]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderResult.rows[0];

        const asaasPayment = await asaas.createPayment({
            billingType: 'CREDIT_CARD',
            amount: parseFloat(order.total),
            orderNumber: order.order_number,
            customer: order,
            card: {
                holderName: card.holder,
                number: card.number.replace(/\D/g, ''),
                expiryMonth: card.exp_month,
                expiryYear: card.exp_year,
                ccv: card.cvv
            },
            installments: installments || 1
        });

        const paymentResult = await pool.query(
            `INSERT INTO payments (order_id, method, amount, status, transaction_id, provider_response)
             VALUES ($1, 'credit_card_asaas', $2, $3, $4, $5)
             ON CONFLICT (order_id) DO UPDATE SET
                method = EXCLUDED.method,
                amount = EXCLUDED.amount,
                status = EXCLUDED.status,
                transaction_id = EXCLUDED.transaction_id,
                provider_response = EXCLUDED.provider_response
             RETURNING *`,
            [
                order_id,
                order.total,
                asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'RECEIVED' ? 'confirmed' : 'pending',
                asaasPayment.id,
                JSON.stringify(asaasPayment)
            ]
        );

        if (asaasPayment.status === 'CONFIRMED' || asaasPayment.status === 'RECEIVED') {
            await pool.query(
                "UPDATE orders SET status = 'payment_confirmed', paid_at = NOW(), payment_method = 'credit_card_asaas' WHERE id = $1",
                [order_id]
            );
        } else {
            await pool.query(
                "UPDATE orders SET status = 'awaiting_payment', payment_method = 'credit_card_asaas' WHERE id = $1",
                [order_id]
            );
        }

        res.status(201).json({
            success: true,
            data: {
                payment: paymentResult.rows[0],
                status: asaasPayment.status
            }
        });
    } catch (err) {
        console.error('Error processing Asaas Card:', err);
        res.status(500).json({ error: err.message || 'Failed to process card payment' });
    }
});

// ── Asaas Boleto ─────────────────────────────────────────────────────────────

// POST /payments/boleto — Generate Boleto via Asaas
router.post('/boleto', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { order_id } = req.body;

        const orderResult = await pool.query(
            `SELECT o.*, c.name, c.email, c.phone, c.document, c.address_zip, c.address_number, c.address_street
             FROM orders o 
             JOIN customers c ON o.customer_id = c.id 
             WHERE o.id = $1`,
            [order_id]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = orderResult.rows[0];

        const asaasPayment = await asaas.createPayment({
            billingType: 'BOLETO',
            amount: parseFloat(order.total),
            orderNumber: order.order_number,
            customer: order
        });

        const boletoDetails = await asaas.getBoletoDetails(asaasPayment.id);

        const paymentResult = await pool.query(
            `INSERT INTO payments (order_id, method, amount, status, transaction_id, provider_response)
             VALUES ($1, 'boleto_asaas', $2, 'pending', $3, $4)
             ON CONFLICT (order_id) DO UPDATE SET
                method = EXCLUDED.method,
                amount = EXCLUDED.amount,
                status = EXCLUDED.status,
                transaction_id = EXCLUDED.transaction_id,
                provider_response = EXCLUDED.provider_response
             RETURNING *`,
            [
                order_id,
                order.total,
                asaasPayment.id,
                JSON.stringify({ ...asaasPayment, boletoDetails })
            ]
        );

        await pool.query(
            "UPDATE orders SET status = 'awaiting_payment', payment_method = 'boleto_asaas' WHERE id = $1",
            [order_id]
        );

        res.status(201).json({
            data: {
                payment: paymentResult.rows[0],
                bank_slip_url: asaasPayment.bankSlipUrl,
                bar_code: boletoDetails.barCode,
                identification_field: boletoDetails.identificationField
            }
        });
    } catch (err) {
        console.error('Error generating Asaas Boleto:', err);
        res.status(500).json({ error: err.message || 'Failed to generate boleto' });
    }
});

// ── Confirmation & Webhooks ─────────────────────────────────────────────────

// POST /payments/confirm — Manually confirm payment
router.post('/confirm', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { order_id, transaction_id, method } = req.body;

        await pool.query(
            `UPDATE payments SET status = 'confirmed', transaction_id = $1, paid_at = NOW()
       WHERE order_id = $2 AND status = 'pending'`,
            [transaction_id || 'manual', order_id]
        );

        await pool.query(
            `UPDATE orders SET status = 'payment_confirmed', paid_at = NOW(),
       payment_method = COALESCE($2, payment_method)
       WHERE id = $1`,
            [order_id, method]
        );

        const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [order_id]);
        res.json({ data: orderResult.rows[0] });
    } catch (err) {
        console.error('Error confirming payment:', err);
        res.status(500).json({ error: 'Failed to confirm payment' });
    }
});

// POST /payments/webhook — External payment callback
router.post('/webhook', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { order_number, transaction_id, status: paymentStatus } = req.body;

        if (paymentStatus === 'confirmed' || paymentStatus === 'approved') {
            const orderResult = await pool.query('SELECT id FROM orders WHERE order_number = $1', [order_number]);
            if (orderResult.rows.length > 0) {
                const orderId = orderResult.rows[0].id;

                await pool.query(
                    "UPDATE payments SET status = 'confirmed', transaction_id = $1, paid_at = NOW() WHERE order_id = $2 AND status = 'pending'",
                    [transaction_id, orderId]
                );

                await pool.query(
                    "UPDATE orders SET status = 'payment_confirmed', paid_at = NOW() WHERE id = $1",
                    [orderId]
                );
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Error processing payment webhook:', err);
        res.status(500).json({ error: 'Failed to process webhook' });
    }
});

// ── PIX EMV Payload Builder (BR Code) ───────────────────────────────────────
function buildPixPayload({ pixKey, merchantName, amount, txid, city }) {
    const pad = (id, value) => {
        const len = String(value.length).padStart(2, '0');
        return `${id}${len}${value}`;
    };

    const gui = pad('00', 'BR.GOV.BCB.PIX');
    const key = pad('01', pixKey);
    const merchantAccount = pad('26', gui + key);
    const payloadFormat = pad('00', '01');
    const initMethod = amount > 0 ? pad('01', '12') : '';
    const mcc = pad('52', '0000');
    const currency = pad('53', '986');
    const amountStr = amount > 0 ? pad('54', amount.toFixed(2)) : '';
    const country = pad('58', 'BR');
    const name = pad('59', merchantName.substring(0, 25));
    const cityStr = pad('60', city.substring(0, 15));
    const txidStr = pad('05', txid.substring(0, 25));
    const additionalData = pad('62', txidStr);

    const payloadWithoutCRC = payloadFormat + initMethod + merchantAccount + mcc + currency + amountStr + country + name + cityStr + additionalData + '6304';
    const crc = crc16ccitt(payloadWithoutCRC);

    return payloadWithoutCRC + crc;
}

function crc16ccitt(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

module.exports = router;
