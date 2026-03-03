const { Router } = require('express');
const router = Router();

// POST /webhooks/n8n — Receive commands from n8n workflows
router.post('/n8n', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { action, payload } = req.body;

        switch (action) {
            case 'get_catalog': {
                const { category } = payload || {};
                let query = 'SELECT id, sku, name, category, price, promo_price, image_url, stock_qty FROM products WHERE active = true';
                const params = [];
                if (category) { query += ' AND category = $1'; params.push(category); }
                query += ' ORDER BY category, name LIMIT 50';
                const result = await pool.query(query, params);
                return res.json({ data: result.rows });
            }

            case 'get_customer': {
                const phone = (payload.phone || '').replace(/\D/g, '');
                const result = await pool.query(
                    'SELECT * FROM customers WHERE phone LIKE $1',
                    [`%${phone.slice(-9)}`]
                );
                return res.json({ data: result.rows[0] || null });
            }

            case 'create_customer': {
                const { name, phone, email } = payload;
                const result = await pool.query(
                    `INSERT INTO customers (name, phone, email) VALUES ($1, $2, $3)
           ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, customers.name), updated_at = NOW()
           RETURNING *`,
                    [name, phone, email]
                );
                return res.json({ data: result.rows[0] });
            }

            case 'create_order': {
                const { customer_id, items, channel, notes, delivery_address, delivery_fee, payment_method } = payload;

                const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const countResult = await pool.query("SELECT COUNT(*) FROM orders WHERE order_number LIKE $1", [`NP-${today}-%`]);
                const seq = String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0');
                const orderNumber = `NP-${today}-${seq}`;

                let subtotal = 0;
                const orderItems = [];

                for (const item of items) {
                    const pResult = await pool.query('SELECT id, name, sku, price, promo_price FROM products WHERE id = $1', [item.product_id]);
                    if (pResult.rows.length === 0) continue;
                    const p = pResult.rows[0];
                    const unitPrice = parseFloat(p.promo_price || p.price);
                    const qty = parseInt(item.quantity);
                    subtotal += unitPrice * qty;
                    orderItems.push({ product_id: p.id, sku: p.sku, name: p.name, quantity: qty, unit_price: unitPrice, total: unitPrice * qty });
                }

                const total = subtotal + parseFloat(delivery_fee || 0);

                const orderResult = await pool.query(
                    `INSERT INTO orders (order_number, customer_id, status, channel, subtotal, delivery_fee, total, delivery_address, notes, payment_method)
           VALUES ($1, $2, 'quote_sent', $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                    [orderNumber, customer_id, channel || 'whatsapp', subtotal, delivery_fee || 0, total, delivery_address, notes, payment_method]
                );
                const order = orderResult.rows[0];

                for (const item of orderItems) {
                    await pool.query(
                        'INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, total) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                        [order.id, item.product_id, item.sku, item.name, item.quantity, item.unit_price, item.total]
                    );
                }

                try {
                    const { getOrderById } = require('./orders');
                    if (getOrderById) {
                        const fullOrder = await getOrderById(pool, order.id);
                        if (fullOrder) {
                            const chatwootService = require('../services/chatwoot');
                            await chatwootService.notifyNewOrder(fullOrder);

                            const BlingService = require('../services/bling');
                            const bling = new BlingService(pool);
                            const customerData = {
                                id: fullOrder.customer_id,
                                name: fullOrder.customer_name,
                                document: fullOrder.document,
                                document_type: fullOrder.document_type,
                                bling_id: fullOrder.bling_id,
                                phone: fullOrder.customer_phone,
                                email: fullOrder.customer_email,
                                address_street: fullOrder.address_street,
                                address_number: fullOrder.address_number,
                                address_complement: fullOrder.address_complement,
                                address_city: fullOrder.address_city,
                                address_state: fullOrder.address_state,
                                address_zip: fullOrder.address_zip,
                                address_neighborhood: fullOrder.address_neighborhood
                            };
                            await bling.createOrder(fullOrder, fullOrder.items, customerData);
                        }
                    }
                } catch (err) {
                    console.error('Error integrating n8n create_order:', err);
                }

                return res.json({ data: { ...order, items: orderItems } });
            }

            case 'update_order_status': {
                const { order_id, status, operator_confirmed_by, internal_notes } = payload;
                const updates = ['status = $1'];
                const params = [status, order_id];
                let idx = 3;

                if (operator_confirmed_by) { updates.push(`operator_confirmed_by = $${idx++}`); params.splice(idx - 2, 0, operator_confirmed_by); }
                if (internal_notes) { updates.push(`internal_notes = $${idx++}`); params.splice(idx - 2, 0, internal_notes); }
                if (status === 'payment_confirmed') updates.push('paid_at = NOW()');
                if (status === 'delivered') updates.push('delivered_at = NOW()');

                const result = await pool.query(`UPDATE orders SET ${updates.join(', ')} WHERE id = $2 RETURNING *`, params);
                return res.json({ data: result.rows[0] });
            }

            case 'get_order': {
                const { order_id, order_number } = payload;
                let query, params;
                if (order_id) { query = 'SELECT * FROM orders WHERE id = $1'; params = [order_id]; }
                else { query = 'SELECT * FROM orders WHERE order_number = $1'; params = [order_number]; }

                const result = await pool.query(query, params);
                if (result.rows.length === 0) return res.json({ data: null });

                const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [result.rows[0].id]);
                return res.json({ data: { ...result.rows[0], items: items.rows } });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }
    } catch (err) {
        console.error('Error processing n8n webhook:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /webhooks/bling — Receive Bling ERP callbacks
router.post('/bling', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { data } = req.body;

        // Bling sends events for order/product updates
        const payloadStr = req.body.data || req.body;
        const payload = typeof payloadStr === 'string' ? JSON.parse(payloadStr) : payloadStr;

        if (payload && payload.retorno) {
            console.log('Bling webhook valid payload received.');
            if (payload.retorno.estoques) {
                for (const est of payload.retorno.estoques) {
                    const item = est.estoque;
                    const stockVal = item.estoqueAtual !== undefined ? item.estoqueAtual : item.estoqueFisico;
                    if (item.idProduto && stockVal !== undefined) {
                        await pool.query('UPDATE products SET stock_qty = $1, updated_at = NOW() WHERE bling_id = $2', [stockVal, item.idProduto]);
                    }
                }
            }
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Error processing Bling webhook:', err);
        res.status(500).json({ error: 'Failed to process Bling webhook' });
    }
});

// POST /webhooks/asaas — Receive Asaas payment updates
router.post('/asaas', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { event, payment } = req.body;

        console.log(`Asaas webhook event: ${event} for payment ${payment.id}`);

        // Verify token (optional, recommended if ASAAS_WEBHOOK_SECRET is set)
        const token = req.headers['asaas-access-token'];
        if (process.env.ASAAS_WEBHOOK_SECRET && token !== process.env.ASAAS_WEBHOOK_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const orderNumber = payment.externalReference;
        const transactionId = payment.id;

        // Process based on event
        if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
            const orderResult = await pool.query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
            if (orderResult.rows.length > 0) {
                const orderId = orderResult.rows[0].id;

                await pool.query(
                    "UPDATE payments SET status = 'confirmed', paid_at = NOW() WHERE transaction_id = $1 AND status = 'pending'",
                    [transactionId]
                );

                await pool.query(
                    "UPDATE orders SET status = 'payment_confirmed', paid_at = NOW() WHERE id = $1 AND status != 'payment_confirmed'",
                    [orderId]
                );
            }
        } else if (event === 'PAYMENT_REFUNDED' || event === 'PAYMENT_CHARGEBACK_REQUESTED') {
            await pool.query(
                "UPDATE orders SET status = 'canceled', internal_notes = COALESCE(internal_notes, '') || '\nPagamento estornado no Asaas.' WHERE order_number = $1",
                [orderNumber]
            );
        }

        res.json({ received: true });
    } catch (err) {
        console.error('Error processing Asaas webhook:', err);
        res.status(500).json({ error: 'Failed' });
    }
});

module.exports = router;
