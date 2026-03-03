const { Router } = require('express');
const router = Router();
const specialist = require('../services/pool-specialist');

/**
 * POST /specialist/calculate
 * Body: { shape, dims: { length, width, depth, diameter } }
 */
router.post('/calculate', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { shape, dims } = req.body;
        const volume = specialist.calculateVolume(shape, dims);
        const dosages = specialist.getDosageRecommendations(volume);

        // Enrich with real products from DB (search by category/name)
        const productMatches = {};
        for (const [key, dosage] of Object.entries(dosages)) {
            const searchTerm = dosage.name.split(' ').slice(0, 2).join('%');
            const dbResult = await pool.query(
                `SELECT id, name, price, image_url, sku FROM products 
                 WHERE active = true AND name ILIKE $1 LIMIT 2`,
                [`%${searchTerm}%`]
            );
            if (dbResult.rows.length > 0) {
                dosages[key].products = dbResult.rows;
            }
        }

        res.json({
            success: true,
            data: {
                volume_liters: volume,
                dosages
            }
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

/**
 * POST /specialist/diagnose
 * Body: { issue_code }
 */
router.post('/diagnose', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { issue_code } = req.body;
        const diagnosis = specialist.diagnose(issue_code);

        if (!diagnosis) {
            return res.status(404).json({ error: 'Problema não identificado' });
        }

        // Enrich SKU suggestions with real products from DB
        if (diagnosis.recommended_skus && diagnosis.recommended_skus.length > 0) {
            const dbResult = await pool.query(
                `SELECT id, name, price, image_url, sku FROM products 
                 WHERE active = true AND (
                     name ILIKE '%cloro%' OR name ILIKE '%algicida%' OR 
                     name ILIKE '%clarificante%' OR name ILIKE '%floc%' OR 
                     name ILIKE '%ph%' OR name ILIKE '%barrilha%'
                 ) LIMIT 10`
            );
            diagnosis.available_products = dbResult.rows;
        }

        res.json({
            success: true,
            data: diagnosis
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /specialist/knowledge
 * Returns the entire product knowledge base for bot/AI context
 */
router.get('/knowledge', (req, res) => {
    const pk = require('../data/product_knowledge.json');
    res.json({ success: true, data: pk });
});

module.exports = router;
