const { Router } = require('express');
const router = Router();

// POST /orders — Create order from cart or direct
router.post('/', async (req, res) => {
    const pool = req.app.locals.pool;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { customer_id, session_id, items, delivery_address, delivery_fee = 0, discount = 0, notes, channel = 'web', payment_method } = req.body;

        // Generate order number: NP-YYYYMMDD-XXXX
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const countResult = await client.query(
            "SELECT COUNT(*) FROM orders WHERE order_number LIKE $1",
            [`NP-${today}-%`]
        );
        const seq = String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0');
        const orderNumber = `NP-${today}-${seq}`;

        // Resolve items from cart or direct body
        let orderItems = [];

        if (session_id) {
            const cartResult = await client.query(
                `SELECT ci.product_id, ci.quantity, ci.unit_price, p.name, p.sku
         FROM cart_items ci
         JOIN carts c ON ci.cart_id = c.id
         JOIN products p ON ci.product_id = p.id
         WHERE c.session_id = $1`,
                [session_id]
            );
            orderItems = cartResult.rows;
        } else if (items && items.length > 0) {
            for (const item of items) {
                const p = await client.query('SELECT id, name, sku, price, promo_price FROM products WHERE id = $1', [item.product_id]);
                if (p.rows.length === 0) throw new Error(`Product ${item.product_id} not found`);
                const prod = p.rows[0];
                orderItems.push({
                    product_id: prod.id,
                    quantity: item.quantity,
                    unit_price: prod.promo_price || prod.price,
                    name: prod.name,
                    sku: prod.sku
                });
            }
        } else {
            throw new Error('No items provided');
        }

        if (orderItems.length === 0) throw new Error('Empty order');

        const subtotal = orderItems.reduce((sum, item) => sum + (parseFloat(item.unit_price) * item.quantity), 0);
        const total = subtotal - parseFloat(discount) + parseFloat(delivery_fee);

        // Create order
        const orderResult = await client.query(
            `INSERT INTO orders (order_number, customer_id, status, payment_method, channel, subtotal, discount, delivery_fee, total, delivery_address, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [orderNumber, customer_id, 'quote_sent', payment_method || null, channel, subtotal, discount, delivery_fee, total, delivery_address, notes]
        );
        const order = orderResult.rows[0];

        // Create order items
        for (const item of orderItems) {
            const itemTotal = parseFloat(item.unit_price) * item.quantity;
            await client.query(
                `INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [order.id, item.product_id, item.sku, item.name, item.quantity, item.unit_price, itemTotal]
            );
        }

        // Clean up cart if from session
        if (session_id) {
            await client.query('DELETE FROM carts WHERE session_id = $1', [session_id]);
        }

        await client.query('COMMIT');

        // Fetch complete order
        const fullOrder = await getOrderById(pool, order.id);

        try {
            const chatwootService = require('../services/chatwoot');
            await chatwootService.notifyNewOrder(fullOrder);

            const BlingService = require('../services/bling');
            const bling = new BlingService(pool);
            const customerData = {
                id: fullOrder.customer_id,
                name: fullOrder.customer_name,
                document: fullOrder.document,
                document_type: fullOrder.document_type,
                ie: fullOrder.ie,
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
        } catch (err) {
            console.error('Error integrating new order:', err);
        }

        res.status(201).json({ data: fullOrder });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error creating order:', err);
        res.status(500).json({ error: err.message || 'Failed to create order' });
    } finally {
        client.release();
    }
});

// GET /orders — List orders with filters
router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { status, customer_id, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = 'SELECT o.*, c.name as customer_name, c.phone as customer_phone FROM orders o JOIN customers c ON o.customer_id = c.id WHERE 1=1';
        const params = [];
        let idx = 1;

        if (status) { query += ` AND o.status = $${idx++}`; params.push(status); }
        if (customer_id) { query += ` AND o.customer_id = $${idx++}`; params.push(customer_id); }

        const countResult = await pool.query(query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM'), params);
        const total = parseInt(countResult.rows[0].count);

        query += ` ORDER BY o.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            data: result.rows,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (err) {
        console.error('Error listing orders:', err);
        res.status(500).json({ error: 'Failed to list orders' });
    }
});

// GET /orders/:id — Order detail
router.get('/:id', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const order = await getOrderById(pool, req.params.id);
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ data: order });
    } catch (err) {
        console.error('Error getting order:', err);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// GET /orders/number/:orderNumber — Lookup by order number
router.get('/number/:orderNumber', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT id FROM orders WHERE order_number = $1', [req.params.orderNumber]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
        const order = await getOrderById(pool, result.rows[0].id);
        res.json({ data: order });
    } catch (err) {
        console.error('Error getting order by number:', err);
        res.status(500).json({ error: 'Failed to get order' });
    }
});

// PATCH /orders/:id/status — Update order status
router.patch('/:id/status', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { status, payment_method, internal_notes, operator_confirmed_by } = req.body;

        const updates = ['status = $1'];
        const params = [status, req.params.id];
        let idx = 3;

        if (payment_method) { updates.push(`payment_method = $${idx++}`); params.splice(idx - 2, 0, payment_method); }
        if (internal_notes) { updates.push(`internal_notes = $${idx++}`); params.splice(idx - 2, 0, internal_notes); }
        if (operator_confirmed_by) { updates.push(`operator_confirmed_by = $${idx++}`); params.splice(idx - 2, 0, operator_confirmed_by); }

        // Auto-set timestamps
        if (status === 'payment_confirmed') updates.push('paid_at = NOW(), confirmed_at = NOW()');
        if (status === 'delivered') updates.push('delivered_at = NOW()');
        if (status === 'awaiting_operator' && operator_confirmed_by) updates.push('confirmed_at = NOW()');

        const result = await pool.query(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = $2 RETURNING *`,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

        const order = await getOrderById(pool, req.params.id);
        res.json({ data: order });
    } catch (err) {
        console.error('Error updating order status:', err);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Helper: Get full order with items and payments
async function getOrderById(pool, id) {
    const orderResult = await pool.query(
        `SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
            c.address_street, c.address_number, c.address_neighborhood, c.address_city, c.address_state, c.address_zip,
            c.document, c.document_type, c.ie, c.bling_id, c.address_complement
     FROM orders o JOIN customers c ON o.customer_id = c.id WHERE o.id = $1`,
        [id]
    );
    if (orderResult.rows.length === 0) return null;
    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
        'SELECT * FROM order_items WHERE order_id = $1 ORDER BY id', [id]
    );

    const paymentsResult = await pool.query(
        'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC', [id]
    );

    return { ...order, items: itemsResult.rows, payments: paymentsResult.rows };
}

module.exports = router;
module.exports.getOrderById = getOrderById;
