/**
 * Bling ERP API v3 Integration
 * Handles OAuth2 authentication, product sync with images, and order management
 */

const BLING_API_URL = 'https://api.bling.com.br/Api/v3';
const BLING_AUTH_URL = 'https://www.bling.com.br/Api/v3/oauth/token';

const minioClient = require('./minioClient');

class BlingService {
    constructor(pool) {
        this.pool = pool;
        this.clientId = process.env.BLING_CLIENT_ID;
        this.clientSecret = process.env.BLING_CLIENT_SECRET;
        this.accessToken = null;
        this.refreshToken = process.env.BLING_REFRESH_TOKEN;
        this.tokenExpiresAt = 0;
    }

    // ── Authentication ──────────────────────────────────────────────────────
    async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiresAt) {
            return this.accessToken;
        }

        // Try to load from DB
        const result = await this.pool.query(
            "SELECT key, value FROM store_settings WHERE key IN ('bling_access_token', 'bling_refresh_token', 'bling_token_expires')"
        );
        const tokens = {};
        result.rows.forEach(r => tokens[r.key] = r.value);

        if (tokens.bling_access_token && parseInt(tokens.bling_token_expires) > Date.now()) {
            this.accessToken = tokens.bling_access_token;
            this.refreshToken = tokens.bling_refresh_token;
            this.tokenExpiresAt = parseInt(tokens.bling_token_expires);
            return this.accessToken;
        }

        // Refresh token
        if (this.refreshToken || tokens.bling_refresh_token) {
            return await this.refreshAccessToken(this.refreshToken || tokens.bling_refresh_token);
        }

        throw new Error('Bling: No refresh token available. Complete OAuth2 authorization first.');
    }

    async refreshAccessToken(refreshToken) {
        const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

        const response = await fetch(BLING_AUTH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`
            },
            body: `grant_type=refresh_token&refresh_token=${refreshToken}`
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Bling OAuth2 refresh failed: ${error}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;
        this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;

        await this.saveTokens();
        return this.accessToken;
    }

    async saveTokens() {
        const upsert = `INSERT INTO store_settings (key, value) VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`;
        await this.pool.query(upsert, ['bling_access_token', this.accessToken]);
        await this.pool.query(upsert, ['bling_refresh_token', this.refreshToken]);
        await this.pool.query(upsert, ['bling_token_expires', String(this.tokenExpiresAt)]);
    }

    // ── API Calls ───────────────────────────────────────────────────────────
    async apiRequest(method, path, body = null) {
        const token = await this.getAccessToken();

        const options = {
            method,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
            }
        };

        if (body) options.body = JSON.stringify(body);

        console.log(`[BLING DEBUG] ${method} ${path}`);

        const response = await fetch(`${BLING_API_URL}${path}`, options);
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Failed to parse JSON response', raw: await response.text() };
        }

        if (!response.ok) {
            console.error(`[BLING ERROR] ${method} ${path} (${response.status}):`, JSON.stringify(data));
        }

        if (response.status === 401) {
            await this.refreshAccessToken(this.refreshToken);
            options.headers.Authorization = `Bearer ${this.accessToken}`;
            const retryResponse = await fetch(`${BLING_API_URL}${path}`, options);
            return await retryResponse.json();
        }

        if (response.status === 429) {
            // Rate limit — wait 1s and retry
            await new Promise(r => setTimeout(r, 1000));
            return this.apiRequest(method, path, body);
        }

        return data;
    }

    // ── Products ────────────────────────────────────────────────────────────
    async listProducts(page = 1, storeId = null) {
        let endpoint = `/produtos?pagina=${page}&limite=100`;
        if (storeId) {
            endpoint = `/produtos/lojas?idLoja=${storeId}&pagina=${page}&limite=100`;
        }
        return await this.apiRequest('GET', endpoint);
    }

    async getProductDetail(blingId) {
        return await this.apiRequest('GET', `/produtos/${blingId}`);
    }

    /**
     * Full product sync: pulls products from Bling, upserts into local DB,
     * fetches images and category from product detail endpoint.
     */
    async syncProducts() {
        let page = 1;
        let hasMore = true;
        let synced = 0;
        let created = 0;
        let updated = 0;
        let errors = [];

        const storeId = process.env.BLING_STORE_ID || null;

        console.log(`[BLING SYNC] Starting full product sync... ${storeId ? '(Store Filter: ' + storeId + ')' : '(All Active)'}`);

        while (hasMore) {
            const listResult = await this.listProducts(page, storeId);
            const products = listResult.data || [];

            if (products.length === 0) {
                hasMore = false;
                break;
            }

            for (const p of products) {
                try {
                    // Fetch detailed product info (including images and category)
                    const detail = await this.getProductDetail(p.id);
                    const prod = detail.data || p;

                    // Extract images array from Bling
                    const blingImages = [];
                    if (prod.midia && prod.midia.imagens && prod.midia.imagens.internas) {
                        for (const img of prod.midia.imagens.internas) {
                            if (img.link) blingImages.push(img.link);
                        }
                    }
                    if (prod.midia && prod.midia.imagens && prod.midia.imagens.externas) {
                        for (const img of prod.midia.imagens.externas) {
                            if (img.link) blingImages.push(img.link);
                        }
                    }
                    // Fallback: use imageThumbnail from list endpoint
                    if (blingImages.length === 0 && p.imageThumbnail) {
                        blingImages.push(p.imageThumbnail);
                    }
                    // Extract category
                    let category = null;
                    if (prod.categoria && prod.categoria.descricao) {
                        category = prod.categoria.descricao;
                    }

                    // Upload images to MinIO and get public URLs
                    const minioUrls = await this.uploadImagesToMinIO(blingImages, category || 'Uncategorized');
                    // Use the first MinIO URL as the primary image
                    const primaryImageUrl = minioUrls[0] || (blingImages.length > 0 ? blingImages[0] : null);

                    // Extract weight
                    let weightKg = null;
                    if (prod.pesoBruto) {
                        weightKg = parseFloat(prod.pesoBruto);
                    }

                    // Extract stock
                    let stockQty = 0;
                    if (prod.estoque && prod.estoque.saldoFisicoTotal !== undefined) {
                        stockQty = parseInt(prod.estoque.saldoFisicoTotal);
                    } else if (p.estoque && p.estoque.saldoFisicoTotal !== undefined) {
                        stockQty = parseInt(p.estoque.saldoFisicoTotal);
                    }

                    let productName = prod.nome || p.nome;
                    let productPrice = parseFloat(prod.preco || p.preco || 0);

                    // If filtered by store, use the store-specific override
                    if (storeId && p.produto) {
                        if (p.nome) productName = p.nome;
                        if (p.preco) productPrice = parseFloat(p.preco);
                        // p.produto represents the base product when calling /lojas
                        p.id = p.produto.id;
                        prod.codigo = p.produto.codigo || prod.codigo;
                    }

                    // Check if product already exists
                    const existing = await this.pool.query(
                        'SELECT id FROM products WHERE bling_id = $1', [p.id]
                    );

                    if (existing.rows.length > 0) {
                        // UPDATE existing product
                        await this.pool.query(
                            `UPDATE products SET
                                name = $1, description = $2, price = $3,
                                stock_qty = $4, unit = $5, category = $6,
                                weight_kg = $7, image_url = $8, images = $9,
                                sku = COALESCE(NULLIF($10, ''), sku),
                                active = true, updated_at = NOW()
                             WHERE bling_id = $11`,
                            [
                                productName,
                                this.cleanDescription(prod.descricaoCurta || prod.descricao || ''),
                                productPrice,
                                stockQty,
                                prod.unidade || p.unidade || 'UN',
                                category,
                                weightKg,
                                primaryImageUrl,
                                JSON.stringify(minioUrls),
                                prod.codigo || p.codigo || '',
                                p.id
                            ]
                        );
                        updated++;
                    } else {
                        // INSERT new product
                        const sku = prod.codigo || p.codigo || `B${p.id}`;
                        await this.pool.query(
                            `INSERT INTO products (bling_id, sku, name, description, category, unit, price, stock_qty, weight_kg, image_url, images, active)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
                             ON CONFLICT (sku) DO UPDATE SET
                                bling_id = EXCLUDED.bling_id, name = EXCLUDED.name,
                                description = EXCLUDED.description, price = EXCLUDED.price,
                                stock_qty = EXCLUDED.stock_qty, category = EXCLUDED.category,
                                weight_kg = EXCLUDED.weight_kg, image_url = EXCLUDED.image_url,
                                images = EXCLUDED.images, active = true, updated_at = NOW()`,
                            [
                                p.id,
                                sku,
                                productName,
                                this.cleanDescription(prod.descricaoCurta || prod.descricao || ''),
                                category,
                                prod.unidade || p.unidade || 'UN',
                                productPrice,
                                stockQty,
                                weightKg,
                                primaryImageUrl,
                                JSON.stringify(minioUrls)
                            ]
                        );
                        created++;
                    }

                    synced++;

                    // Small delay to respect rate limits
                    if (synced % 5 === 0) {
                        await new Promise(r => setTimeout(r, 500));
                    }
                } catch (err) {
                    console.error(`[BLING SYNC] Error syncing product ${p.id} (${p.nome}):`, err.message);
                    errors.push({ bling_id: p.id, name: p.nome, error: err.message });
                }
            }

            console.log(`[BLING SYNC] Page ${page}: ${products.length} products processed`);
            page++;
            if (products.length < 100) hasMore = false;
        }

        // Mark products not in Bling as inactive
        const blingIds = await this.pool.query(
            'SELECT bling_id FROM products WHERE bling_id IS NOT NULL AND active = true'
        );
        console.log(`[BLING SYNC] Complete! Created: ${created}, Updated: ${updated}, Errors: ${errors.length}`);

        // Save last sync time
        const upsert = `INSERT INTO store_settings (key, value) VALUES ($1, $2)
                     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`;
        await this.pool.query(upsert, ['bling_last_sync', new Date().toISOString()]);
        await this.pool.query(upsert, ['bling_products_count', String(synced)]);

        // Automate frontend JSON update
        try {
            await this.updateFrontendJson();
        } catch (jsonErr) {
            console.error('[BLING SYNC] Failed to update frontend JSON:', jsonErr.message);
        }

        return { synced, created, updated, errors, pages: page - 1 };
    }

    /**
     * Upload arrays of internal/external images to MinIO
     */
    async uploadImagesToMinIO(imageUrls, category) {
        if (!imageUrls || imageUrls.length === 0) return [];
        const uploadedUrls = [];
        const safeCategory = category.replace(/[^a-zA-Z0-9]/g, '_');

        for (const url of imageUrls) {
            try {
                // If already a MinIO URL, skip
                if (url.includes('s3.extensionista.site')) {
                    uploadedUrls.push(url);
                    continue;
                }

                const response = await fetch(url);
                if (!response.ok) continue;

                const contentType = response.headers.get('content-type') || 'image/jpeg';
                const extension = contentType.split('/')[1] || 'jpg';
                const buffer = Buffer.from(await response.arrayBuffer());

                // Construct filename: products/{Category}/{basename}_{hash}.{ext}
                const urlParts = url.split('/');
                const baseName = urlParts[urlParts.length - 1].split('?')[0].split('.')[0] || 'img';
                const filename = `products/${safeCategory}/${baseName}_${Math.random().toString(36).substring(7)}.${extension}`;

                const publicUrl = await minioClient.uploadFile(buffer, filename);
                uploadedUrls.push(publicUrl);
            } catch (err) {
                console.error(`[BLING SYNC] Failed to upload image ${url}:`, err.message);
            }
        }
        return uploadedUrls;
    }

    /**
     * Export active products from DB to static JSON for frontend
     */
    async updateFrontendJson() {
        const jsonPath = '/NORTE_PISCINAS/produtos_landing.json';
        const fs = require('fs').promises;

        const result = await this.pool.query(
            "SELECT bling_id as id, sku, name, price, unit, stock_qty as stock, category, images FROM products WHERE active = true ORDER BY category, name"
        );

        const products = result.rows.map(row => ({
            ...row,
            brand: "", // Not explicitly tracked yet
            category_commercial: row.category || "Geral",
            images: typeof row.images === 'string' ? JSON.parse(row.images) : (row.images || [])
        }));

        await fs.writeFile(jsonPath, JSON.stringify(products, null, 2), 'utf-8');
        console.log(`[BLING SYNC] Successfully updated ${products.length} products in ${jsonPath}`);
    }

    /**
     * Clean HTML tags from Bling description
     */
    cleanDescription(html) {
        if (!html) return '';
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // ── Orders ──────────────────────────────────────────────────────────────
    async createOrder(order, items, customer) {
        const blingOrder = {
            data: new Date(order.created_at).toISOString().slice(0, 10),
            dataPrevista: order.delivery_date || undefined,
            contato: customer.bling_id
                ? { id: customer.bling_id }
                : {
                    nome: customer.name,
                    numeroDocumento: customer.document || '',
                    tipo: customer.document_type || 'F'
                },
            itens: items.map(item => ({
                codigo: item.sku,
                unidade: 'UN',
                quantidade: item.quantity,
                valor: parseFloat(item.unit_price),
                descricao: item.name
            })),
            observacoes: order.notes || '',
            observacoesInternas: `Etiqueta: ECOMMERCE\nPedido web/WhatsApp: ${order.order_number}`
        };

        if (parseFloat(order.delivery_fee) > 0) {
            blingOrder.transporte = {
                fretePorConta: 0,
                frete: parseFloat(order.delivery_fee)
            };

            if (customer.address_street) {
                blingOrder.transporte.etiqueta = {
                    nome: customer.name,
                    endereco: customer.address_street,
                    numero: customer.address_number || '',
                    complemento: customer.address_complement || '',
                    municipio: customer.address_city || '',
                    uf: customer.address_state || '',
                    cep: (customer.address_zip || '').replace(/\D/g, ''),
                    bairro: customer.address_neighborhood || ''
                };
            }
        }

        if (parseFloat(order.discount) > 0) {
            blingOrder.desconto = {
                valor: parseFloat(order.discount),
                unidade: 'REAL'
            };
        }

        const result = await this.apiRequest('POST', '/pedidos/vendas', blingOrder);

        if (result.data && result.data.id) {
            console.log(`[BLING SUCCESS] Order created: ${result.data.id}`);
            await this.pool.query('UPDATE orders SET bling_id = $1 WHERE id = $2', [result.data.id, order.id]);
        } else {
            console.error(`[BLING FAILURE] Order creation failed:`, JSON.stringify(result));
        }

        return result;
    }

    async getOrder(blingId) {
        return await this.apiRequest('GET', `/pedidos/vendas/${blingId}`);
    }

    // ── Contacts ────────────────────────────────────────────────────────────
    async findOrCreateContact(customer) {
        if (customer.document) {
            const searchResult = await this.apiRequest('GET', `/contatos?numeroDocumento=${customer.document}`);
            if (searchResult.data && searchResult.data.length > 0) {
                const blingId = searchResult.data[0].id;
                await this.pool.query('UPDATE customers SET bling_id = $1 WHERE id = $2', [blingId, customer.id]);
                return blingId;
            }
        }

        const contactData = {
            nome: customer.name,
            numeroDocumento: customer.document || '',
            tipo: customer.document_type || 'F',
            situacao: 'A',
            telefone: customer.phone,
            email: customer.email || ''
        };

        if (customer.ie) {
            contactData.inscricaoEstadual = customer.ie;
            if (customer.ie.toLowerCase() === 'isento') {
                contactData.indicadorIe = 2; // Isento
            } else {
                contactData.indicadorIe = 1; // Contribuinte
            }
        } else if (contactData.tipo === 'J') {
            contactData.indicadorIe = 9; // Não Contribuinte (se não enviou IE e é PJ)
        } else {
            contactData.indicadorIe = 9; // PF
        }

        if (customer.address_street) {
            contactData.endereco = {
                geral: {
                    endereco: customer.address_street,
                    numero: customer.address_number || '',
                    complemento: customer.address_complement || '',
                    bairro: customer.address_neighborhood || '',
                    cep: (customer.address_zip || '').replace(/\D/g, ''),
                    municipio: customer.address_city || '',
                    uf: customer.address_state || ''
                }
            };
        }

        const result = await this.apiRequest('POST', '/contatos', contactData);
        if (result.data && result.data.id) {
            console.log(`[BLING SUCCESS] Contact created: ${result.data.id}`);
            await this.pool.query('UPDATE customers SET bling_id = $1 WHERE id = $2', [result.data.id, customer.id]);
            return result.data.id;
        } else {
            console.error(`[BLING FAILURE] Contact creation failed:`, JSON.stringify(result));
        }

        return null;
    }
}

module.exports = BlingService;
