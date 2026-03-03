const { Router } = require('express');
const router = Router();

// POST /customers — Create or update customer
router.post('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { name, phone, email, document, document_type, ie, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, notes } = req.body;

        if (!phone || !name) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        const result = await pool.query(
            `INSERT INTO customers (name, phone, email, document, document_type, ie, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (phone) DO UPDATE SET
         name = COALESCE(EXCLUDED.name, customers.name),
         email = COALESCE(EXCLUDED.email, customers.email),
         document = COALESCE(EXCLUDED.document, customers.document),
         document_type = COALESCE(EXCLUDED.document_type, customers.document_type),
         ie = COALESCE(EXCLUDED.ie, customers.ie),
         address_street = COALESCE(EXCLUDED.address_street, customers.address_street),
         address_number = COALESCE(EXCLUDED.address_number, customers.address_number),
         address_complement = COALESCE(EXCLUDED.address_complement, customers.address_complement),
         address_neighborhood = COALESCE(EXCLUDED.address_neighborhood, customers.address_neighborhood),
         address_city = COALESCE(EXCLUDED.address_city, customers.address_city),
         address_state = COALESCE(EXCLUDED.address_state, customers.address_state),
         address_zip = COALESCE(EXCLUDED.address_zip, customers.address_zip),
         notes = COALESCE(EXCLUDED.notes, customers.notes),
         updated_at = NOW()
       RETURNING *`,
            [name, phone, email, document, document_type || 'F', ie || null, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, notes]
        );

        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error creating customer:', err);
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

// GET /customers/:phone — Lookup by phone
router.get('/phone/:phone', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const phone = req.params.phone.replace(/\D/g, '');

        const result = await pool.query(
            'SELECT * FROM customers WHERE phone LIKE $1',
            [`%${phone.slice(-9)}`]  // Match last 9 digits
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error finding customer:', err);
        res.status(500).json({ error: 'Failed to find customer' });
    }
});

// GET /customers/:id — Get by ID
router.get('/:id', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Include order history
        const orders = await pool.query(
            'SELECT id, order_number, status, total, created_at FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 10',
            [req.params.id]
        );

        res.json({ data: { ...result.rows[0], recent_orders: orders.rows } });
    } catch (err) {
        console.error('Error getting customer:', err);
        res.status(500).json({ error: 'Failed to get customer' });
    }
});

// GET /customers — List customers
router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { search, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = 'SELECT * FROM customers WHERE 1=1';
        const params = [];
        let idx = 1;

        if (search) {
            query += ` AND (name ILIKE $${idx} OR phone LIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        query += ` ORDER BY name LIMIT $${idx++} OFFSET $${idx++}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);
        res.json({ data: result.rows });
    } catch (err) {
        console.error('Error listing customers:', err);
        res.status(500).json({ error: 'Failed to list customers' });
    }
});

module.exports = router;
