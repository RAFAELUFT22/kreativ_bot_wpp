-- ============================================================================
-- NORTE PISCINAS — Database Schema
-- ============================================================================

-- Create the database (if running manually)
-- CREATE DATABASE norte_piscinas_db;

-- Switch to the database context (handled by connection string in app)

-- ---------------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
    id              SERIAL PRIMARY KEY,
    bling_id        BIGINT UNIQUE,
    sku             VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    unit            VARCHAR(10) DEFAULT 'UN',
    price           DECIMAL(12,2) NOT NULL,
    promo_price     DECIMAL(12,2),
    stock_qty       INTEGER DEFAULT 0,
    weight_kg       DECIMAL(8,3),
    image_url       TEXT,
    images          JSONB DEFAULT '[]',
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_active ON products(active);
CREATE INDEX idx_products_bling_id ON products(bling_id);

-- ---------------------------------------------------------------------------
-- CUSTOMERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
    id              SERIAL PRIMARY KEY,
    bling_id        BIGINT UNIQUE,
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) UNIQUE NOT NULL,
    email           VARCHAR(255),
    document        VARCHAR(20),
    document_type   VARCHAR(1) DEFAULT 'F',  -- F=Física, J=Jurídica
    address_street  VARCHAR(255),
    address_number  VARCHAR(20),
    address_complement VARCHAR(100),
    address_neighborhood VARCHAR(100),
    address_city    VARCHAR(100),
    address_state   VARCHAR(2),
    address_zip     VARCHAR(10),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_bling_id ON customers(bling_id);

-- ---------------------------------------------------------------------------
-- CARTS (Session-based, for PWA and WhatsApp)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS carts (
    id              SERIAL PRIMARY KEY,
    session_id      VARCHAR(100) UNIQUE NOT NULL,
    customer_id     INTEGER REFERENCES customers(id),
    channel         VARCHAR(20) DEFAULT 'web',  -- 'web', 'whatsapp'
    expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id              SERIAL PRIMARY KEY,
    cart_id         INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------
CREATE TYPE order_status AS ENUM (
    'quote_sent',           -- Orçamento enviado ao cliente
    'awaiting_confirmation', -- Aguardando confirmação do cliente
    'awaiting_payment',     -- Aguardando pagamento (PIX/link)
    'awaiting_operator',    -- Aguardando confirmação do operador (entrega)
    'payment_confirmed',    -- Pagamento confirmado
    'processing',           -- Preparando para entrega
    'out_for_delivery',     -- Saiu para entrega
    'delivered',            -- Entregue
    'cancelled'             -- Cancelado
);

CREATE TYPE payment_method AS ENUM (
    'pix_advance',          -- PIX antecipado
    'payment_link',         -- Link de pagamento
    'cash_on_delivery',     -- Dinheiro na entrega
    'card_on_delivery',     -- Cartão na entrega
    'pix_on_delivery'       -- PIX na entrega
);

CREATE TABLE IF NOT EXISTS orders (
    id              SERIAL PRIMARY KEY,
    order_number    VARCHAR(20) UNIQUE NOT NULL,
    bling_id        BIGINT UNIQUE,
    customer_id     INTEGER NOT NULL REFERENCES customers(id),
    status          order_status DEFAULT 'quote_sent',
    payment_method  payment_method,
    channel         VARCHAR(20) DEFAULT 'web',
    subtotal        DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount        DECIMAL(12,2) DEFAULT 0,
    delivery_fee    DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL DEFAULT 0,
    delivery_address TEXT,
    delivery_date   DATE,
    notes           TEXT,
    internal_notes  TEXT,
    quote_pdf_url   TEXT,
    chatwoot_conversation_id BIGINT,
    operator_confirmed_by VARCHAR(100),
    confirmed_at    TIMESTAMPTZ,
    paid_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_bling_id ON orders(bling_id);
CREATE INDEX idx_orders_number ON orders(order_number);

CREATE TABLE IF NOT EXISTS order_items (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES products(id),
    sku             VARCHAR(50),
    name            VARCHAR(255) NOT NULL,
    quantity        INTEGER NOT NULL,
    unit_price      DECIMAL(12,2) NOT NULL,
    discount        DECIMAL(12,2) DEFAULT 0,
    total           DECIMAL(12,2) NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ---------------------------------------------------------------------------
-- PAYMENTS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id              SERIAL PRIMARY KEY,
    order_id        INTEGER NOT NULL REFERENCES orders(id),
    method          payment_method NOT NULL,
    amount          DECIMAL(12,2) NOT NULL,
    status          VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, failed, refunded
    pix_qr_code     TEXT,
    pix_copy_paste  TEXT,
    payment_link    TEXT,
    transaction_id  VARCHAR(100),
    paid_at         TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ---------------------------------------------------------------------------
-- SETTINGS (key-value for store configuration)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS store_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO store_settings (key, value) VALUES
    ('store_name', 'Norte Piscinas'),
    ('store_phone', ''),
    ('store_whatsapp', ''),
    ('store_email', ''),
    ('store_address', ''),
    ('delivery_fee_default', '0'),
    ('delivery_area', ''),
    ('pix_key', ''),
    ('pix_beneficiary', 'Norte Piscinas'),
    ('min_order_value', '0'),
    ('auto_confirm_payment', 'false')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
