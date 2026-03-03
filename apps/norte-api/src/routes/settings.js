const { Router } = require('express');
const router = Router();

// GET /settings — Get all public settings
router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query('SELECT key, value FROM store_settings');
        const settings = {};
        result.rows.forEach(r => settings[r.key] = r.value);
        res.json({ data: settings });
    } catch (err) {
        console.error('Error getting settings:', err);
        res.status(500).json({ error: 'Failed to get settings' });
    }
});

// PUT /settings — Update settings (admin/n8n)
router.put('/', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const settings = req.body;

        for (const [key, value] of Object.entries(settings)) {
            await pool.query(
                `INSERT INTO store_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
                [key, String(value)]
            );
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
