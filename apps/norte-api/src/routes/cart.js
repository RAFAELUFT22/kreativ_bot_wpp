const { Router } = require('express');
const { v4: uuidv4 } = require('uuid');
const router = Router();

// POST /cart — Add item to cart (create cart if needed)
router.post('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { session_id, product_id, quantity = 1, channel = 'web' } = req.body;

        const sid = session_id || uuidv4();

        // Upsert cart
        await pool.query(
            `INSERT INTO carts (session_id, channel) VALUES ($1, $2)
       ON CONFLICT (session_id) DO UPDATE SET updated_at = NOW()`,
            [sid, channel]
        );

        const cartResult = await pool.query('SELECT id FROM carts WHERE session_id = $1', [sid]);
        const cartId = cartResult.rows[0].id;

        // Get product price
        const productResult = await pool.query('SELECT price, promo_price FROM products WHERE id = $1 AND active = true', [product_id]);
        if (productResult.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const unitPrice = productResult.rows[0].promo_price || productResult.rows[0].price;

        // Upsert cart item
        const existing = await pool.query(
            'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
            [cartId, product_id]
        );

        if (existing.rows.length > 0) {
            await pool.query(
                'UPDATE cart_items SET quantity = quantity + $1, unit_price = $2 WHERE id = $3',
                [parseInt(quantity), unitPrice, existing.rows[0].id]
            );
        } else {
            await pool.query(
                'INSERT INTO cart_items (cart_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
                [cartId, product_id, parseInt(quantity), unitPrice]
            );
        }

        // Return updated cart
        const cart = await getCartBySession(pool, sid);
        res.status(201).json({ data: { session_id: sid, ...cart } });
    } catch (err) {
        console.error('Error adding to cart:', err);
        res.status(500).json({ error: 'Failed to add to cart' });
    }
});

// GET /cart/:sessionId — Get cart contents
router.get('/:sessionId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const cart = await getCartBySession(pool, req.params.sessionId);

        if (!cart) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        res.json({ data: cart });
    } catch (err) {
        console.error('Error getting cart:', err);
        res.status(500).json({ error: 'Failed to get cart' });
    }
});

// DELETE /cart/:sessionId/item/:itemId — Remove item from cart
router.delete('/:sessionId/item/:itemId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const cartResult = await pool.query('SELECT id FROM carts WHERE session_id = $1', [req.params.sessionId]);

        if (cartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        await pool.query(
            'DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
            [req.params.itemId, cartResult.rows[0].id]
        );

        const cart = await getCartBySession(pool, req.params.sessionId);
        res.json({ data: cart });
    } catch (err) {
        console.error('Error removing from cart:', err);
        res.status(500).json({ error: 'Failed to remove from cart' });
    }
});

// PATCH /cart/:sessionId/item/:itemId — Update item quantity
router.patch('/:sessionId/item/:itemId', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { quantity } = req.body;

        const cartResult = await pool.query('SELECT id FROM carts WHERE session_id = $1', [req.params.sessionId]);
        if (cartResult.rows.length === 0) {
            return res.status(404).json({ error: 'Cart not found' });
        }

        if (parseInt(quantity) <= 0) {
            await pool.query('DELETE FROM cart_items WHERE id = $1 AND cart_id = $2',
                [req.params.itemId, cartResult.rows[0].id]);
        } else {
            await pool.query(
                'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND cart_id = $3',
                [parseInt(quantity), req.params.itemId, cartResult.rows[0].id]
            );
        }

        const cart = await getCartBySession(pool, req.params.sessionId);
        res.json({ data: cart });
    } catch (err) {
        console.error('Error updating cart:', err);
        res.status(500).json({ error: 'Failed to update cart' });
    }
});

// Helper: Get full cart data
async function getCartBySession(pool, sessionId) {
    const cartResult = await pool.query(
        `SELECT c.*, cu.name as customer_name, cu.phone as customer_phone
     FROM carts c LEFT JOIN customers cu ON c.customer_id = cu.id
     WHERE c.session_id = $1`,
        [sessionId]
    );

    if (cartResult.rows.length === 0) return null;
    const cart = cartResult.rows[0];

    const itemsResult = await pool.query(
        `SELECT ci.*, p.name, p.sku, p.image_url, p.category
     FROM cart_items ci JOIN products p ON ci.product_id = p.id
     WHERE ci.cart_id = $1 ORDER BY ci.created_at`,
        [cart.id]
    );

    const items = itemsResult.rows.map(item => ({
        ...item,
        total: parseFloat(item.unit_price) * item.quantity
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    return {
        id: cart.id,
        session_id: cart.session_id,
        channel: cart.channel,
        customer: cart.customer_name ? { name: cart.customer_name, phone: cart.customer_phone } : null,
        items,
        subtotal,
        item_count: items.reduce((sum, item) => sum + item.quantity, 0)
    };
}

module.exports = router;
