const { Router } = require('express');
const router = Router();

const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/token';
const BLING_AUTHORIZE_URL = 'https://www.bling.com.br/Api/v3/oauth/authorize';

/**
 * GET /bling/authorize — Redirect user to Bling OAuth2 authorization
 * Visit this URL in a browser to start the OAuth flow
 */
router.get('/authorize', (req, res) => {
    const clientId = process.env.BLING_CLIENT_ID;
    if (!clientId) return res.status(400).json({ error: 'BLING_CLIENT_ID not configured' });

    const redirectUri = `https://api.nortepiscinas.net/bling/callback`;
    const state = Math.random().toString(36).substring(7);

    const url = `${BLING_AUTHORIZE_URL}?response_type=code&client_id=${clientId}&state=${state}`;
    res.redirect(url);
});

/**
 * GET /bling/callback — Handle Bling OAuth2 callback
 * Receives authorization_code and exchanges for access_token + refresh_token
 */
router.get('/callback', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const { code, error } = req.query;

        if (error) return res.status(400).json({ error: `Bling authorization denied: ${error}` });
        if (!code) return res.status(400).json({ error: 'No authorization code received' });

        const clientId = process.env.BLING_CLIENT_ID;
        const clientSecret = process.env.BLING_CLIENT_SECRET;
        const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

        // Exchange code for tokens
        const response = await fetch(BLING_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`
            },
            body: `grant_type=authorization_code&code=${code}`
        });

        if (!response.ok) {
            const err = await response.text();
            return res.status(400).json({ error: `Token exchange failed: ${err}` });
        }

        const data = await response.json();

        // Save tokens to DB
        const upsert = `INSERT INTO store_settings (key, value) VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`;
        await pool.query(upsert, ['bling_access_token', data.access_token]);
        await pool.query(upsert, ['bling_refresh_token', data.refresh_token]);
        await pool.query(upsert, ['bling_token_expires', String(Date.now() + (data.expires_in * 1000) - 60000)]);

        res.json({
            success: true,
            message: 'Bling authorization successful! Tokens saved.',
            expires_in: data.expires_in
        });
    } catch (err) {
        console.error('Bling callback error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /bling/sync-products — Sync products from Bling to local DB
 */
router.post('/sync-products', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const BlingService = require('../services/bling');
        const bling = new BlingService(pool);
        const result = await bling.syncProducts();
        res.json({ success: true, ...result });
    } catch (err) {
        console.error('Bling sync error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /bling/status — Check Bling connection status
 */
router.get('/status', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const result = await pool.query(
            "SELECT key, value FROM store_settings WHERE key IN ('bling_access_token', 'bling_token_expires')"
        );
        const tokens = {};
        result.rows.forEach(r => tokens[r.key] = r.value);

        const hasToken = !!tokens.bling_access_token;
        const expired = tokens.bling_token_expires ? parseInt(tokens.bling_token_expires) < Date.now() : true;

        res.json({
            configured: !!process.env.BLING_CLIENT_ID,
            authenticated: hasToken && !expired,
            token_expires: tokens.bling_token_expires
                ? new Date(parseInt(tokens.bling_token_expires)).toISOString()
                : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /bling/pedidos/vendas — Create a new order in Bling
 */
router.post('/pedidos/vendas', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const BlingService = require('../services/bling');
        const bling = new BlingService(pool);

        // The order payload should contain { order, items, customer }
        const { order, items, customer } = req.body;

        if (!order || !items || !customer) {
            return res.status(400).json({ error: 'Missing order, items, or customer data' });
        }

        const result = await bling.createOrder(order, items, customer);
        res.json(result);
    } catch (err) {
        console.error('Bling create order error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /bling/contatos — Search for a contact in Bling by document or name
 */
router.get('/contatos', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const BlingService = require('../services/bling');
        const bling = new BlingService(pool);

        const { numeroDocumento, nome } = req.query;
        let endpoint = '/contatos';

        if (numeroDocumento) {
            endpoint += `?numeroDocumento=${numeroDocumento}`;
        } else if (nome) {
            endpoint += `?nome=${nome}`;
        }

        const result = await bling.apiRequest('GET', endpoint);
        res.json(result);
    } catch (err) {
        console.error('Bling search contact error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /bling/contatos — Create or update a contact in Bling
 */
router.post('/contatos', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        const BlingService = require('../services/bling');
        const bling = new BlingService(pool);

        // Simplified version: relies on BlingService logic or raw payload
        const customerData = req.body;
        const result = await bling.findOrCreateContact(customerData);
        res.json({ success: true, bling_id: result });
    } catch (err) {
        console.error('Bling upsert contact error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
