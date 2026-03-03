const { Router } = require('express');
const router = Router();

// GET /products — List all active products with optional filters
router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { category, search, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let query = 'SELECT * FROM products WHERE active = true';
        const params = [];
        let paramIndex = 1;

        if (category) {
            query += ` AND category = $${paramIndex++}`;
            params.push(category);
        }

        if (search) {
            query += ` AND (name ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        // Count total
        const countResult = await pool.query(
            query.replace('SELECT *', 'SELECT COUNT(*)'),
            params
        );
        const total = parseInt(countResult.rows[0].count);

        // Get paginated results
        query += ` ORDER BY category, name LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(parseInt(limit), offset);

        const result = await pool.query(query, params);

        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('Error listing products:', err);
        res.status(500).json({ error: 'Failed to list products' });
    }
});

// GET /products/categories — List unique categories
router.get('/categories', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            'SELECT DISTINCT category FROM products WHERE active = true AND category IS NOT NULL ORDER BY category'
        );
        res.json({ data: result.rows.map(r => r.category) });
    } catch (err) {
        console.error('Error listing categories:', err);
        res.status(500).json({ error: 'Failed to list categories' });
    }
});

// GET /products/:id — Product detail
router.get('/:id', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT * FROM products WHERE id = $1 AND active = true', [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error getting product:', err);
        res.status(500).json({ error: 'Failed to get product' });
    }
});

// POST /products — Create product (admin/n8n)
router.post('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { sku, name, description, category, unit, price, promo_price, stock_qty, weight_kg, image_url, images, bling_id } = req.body;

        const result = await pool.query(
            `INSERT INTO products (sku, name, description, category, unit, price, promo_price, stock_qty, weight_kg, image_url, images, bling_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
            [sku, name, description, category, unit || 'UN', price, promo_price, stock_qty || 0, weight_kg, image_url, JSON.stringify(images || []), bling_id]
        );

        res.status(201).json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error creating product:', err);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT /products/:id — Update product
router.put('/:id', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const fields = req.body;
        const setClauses = [];
        const params = [];
        let i = 1;

        for (const [key, value] of Object.entries(fields)) {
            if (['id', 'created_at'].includes(key)) continue;
            setClauses.push(`${key} = $${i++}`);
            params.push(key === 'images' ? JSON.stringify(value) : value);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        params.push(req.params.id);
        const result = await pool.query(
            `UPDATE products SET ${setClauses.join(', ')} WHERE id = $${i} RETURNING *`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ data: result.rows[0] });
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// POST /products/:id/label — Upload technical label
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const minioClient = require('../services/minioClient');

router.post('/:id/label', upload.single('label'), async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const filename = `rotulos/${req.params.id}_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
        const publicUrl = await minioClient.uploadFile(req.file.buffer, filename);

        await pool.query('UPDATE products SET label_url = $1 WHERE id = $2', [publicUrl, req.params.id]);

        res.json({ success: true, label_url: publicUrl });
    } catch (err) {
        console.error('Error uploading label:', err);
        res.status(500).json({ error: 'Failed to upload label' });
    }
});

// POST /products/:id/dosage — Set dosage data
router.post('/:id/dosage', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { recommended_dose, unit, base_unit } = req.body;

        const dosageData = { recommended_dose, unit, base_unit };
        await pool.query('UPDATE products SET dosage_data = $1 WHERE id = $2', [JSON.stringify(dosageData), req.params.id]);

        res.json({ success: true, dosage_data: dosageData });
    } catch (err) {
        console.error('Error updating dosage:', err);
        res.status(500).json({ error: 'Failed to update dosage' });
    }
});

module.exports = router;
