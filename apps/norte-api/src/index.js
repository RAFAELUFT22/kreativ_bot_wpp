const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Pool } = require('pg');

// ── Database ────────────────────────────────────────────────────────────────
const pool = new Pool({
    host: process.env.DB_HOST || 'kreativ_postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'norte_piscinas_db',
    user: process.env.DB_USER || 'kreativ_user',
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
});

// ── App Setup ───────────────────────────────────────────────────────────────
const app = express();
const PORT = parseInt(process.env.PORT || '3000');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(morgan('combined'));
app.use(express.json({ limit: '5mb' }));

// Make pool available to routes
app.locals.pool = pool;

// ── Routes ──────────────────────────────────────────────────────────────────
const productsRouter = require('./routes/products');
const cartRouter = require('./routes/cart');
const ordersRouter = require('./routes/orders');
const customersRouter = require('./routes/customers');
const paymentsRouter = require('./routes/payments');
const webhooksRouter = require('./routes/webhooks');
const settingsRouter = require('./routes/settings');
const blingRouter = require('./routes/bling');
const specialistRouter = require('./routes/specialist');

app.use('/products', productsRouter);
app.use('/cart', cartRouter);
app.use('/orders', ordersRouter);
app.use('/customers', customersRouter);
app.use('/payments', paymentsRouter);
app.use('/webhooks', webhooksRouter);
app.use('/settings', settingsRouter);
app.use('/bling', blingRouter);
app.use('/specialist', specialistRouter);

// ── Health Check ────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ── Error Handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Norte Piscinas API running on port ${PORT}`);
});

module.exports = app;
