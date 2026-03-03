import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function ProductDetail({ sessionId, updateSession, updateCartCount }) {
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);
    const [added, setAdded] = useState(false);

    useEffect(() => { loadProduct(); }, [id]);

    async function loadProduct() {
        setLoading(true);
        try {
            const result = await api.getProduct(id);
            setProduct(result.data);
        } catch (err) {
            console.error('Error loading product:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddToCart() {
        setAdding(true);
        try {
            const result = await api.addToCart({
                session_id: sessionId || undefined,
                product_id: product.id,
                quantity,
            });
            if (result.data.session_id && !sessionId) updateSession(result.data.session_id);
            updateCartCount(result.data.item_count);
            setAdded(true);
            setTimeout(() => setAdded(false), 3000);
        } catch (err) {
            console.error('Error adding to cart:', err);
        } finally {
            setAdding(false);
        }
    }

    const formatPrice = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return <div className="loading"><div className="spinner"></div></div>;
    if (!product) return <div className="empty-state"><h3>Produto não encontrado</h3></div>;

    const imageUrl = product.image_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400"><rect fill="%231E293B" width="600" height="400"/><text x="300" y="200" text-anchor="middle" fill="%2364748B" font-size="60">🏊</text></svg>';

    return (
        <section className="section">
            <div className="container">
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                    <Link to="/produtos" style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        ← Voltar para produtos
                    </Link>
                </div>

                <div className="grid-2">
                    {/* Image */}
                    <div>
                        <img
                            src={imageUrl}
                            alt={product.name}
                            style={{ width: '100%', borderRadius: 'var(--radius-xl)', maxHeight: 500, objectFit: 'cover' }}
                            onError={(e) => { e.target.src = imageUrl; }}
                        />
                    </div>

                    {/* Info */}
                    <div>
                        <span className="product-card__category">{product.category}</span>
                        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, margin: 'var(--space-sm) 0 var(--space-md)' }}>
                            {product.name}
                        </h1>

                        <div className="product-card__price" style={{ marginBottom: 'var(--space-lg)' }}>
                            <span style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                                Sob consulta
                            </span>
                        </div>

                        {product.description && (
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-xl)', lineHeight: 1.7 }}>
                                {product.description}
                            </p>
                        )}

                        <div style={{ display: 'none' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Quantidade:</span>
                                <div className="cart-item__qty">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>−</button>
                                    <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>{quantity}</span>
                                    <button onClick={() => setQuantity(quantity + 1)}>+</button>
                                </div>
                            </div>
                        </div>

                        <button
                            className="btn btn-primary btn-lg btn-full"
                            onClick={() => window.open('https://wa.me/5563999999999', '_blank')}
                        >
                            💬 Consultar no WhatsApp
                        </button>

                        <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--bg-glass)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                🚚 Entrega na cidade • 💰 Pague via PIX ou na entrega • 📱 Dúvidas? Fale pelo WhatsApp
                            </p>
                        </div>

                        {/* Smart Dosage Section */}
                        {(product.label_url || product.dosage_data) && (
                            <div className="dosage-section" style={{ marginTop: 'var(--space-xl)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)' }}>
                                <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-md)' }}>🧪 Uso & Dosagem Inteligente</h3>

                                <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
                                    {product.label_url && (
                                        <a href={product.label_url} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                                            📄 Ver Rótulo Técnico
                                        </a>
                                    )}
                                    <Link to="/especialista" className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', borderColor: '#10B981', color: '#10B981' }}>
                                        🤖 Consultar IA
                                    </Link>
                                </div>

                                {product.dosage_data && (
                                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px dashed #10B981' }}>
                                        <p style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#065F46', marginBottom: '0.5rem' }}>Calculadora de Dosagem:</p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ flex: 1 }}>
                                                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '4px' }}>Volume da piscina (m³):</label>
                                                <input
                                                    type="number"
                                                    placeholder="Ex: 20"
                                                    onChange={(e) => {
                                                        const vol = parseFloat(e.target.value) || 0;
                                                        const result = vol * (product.dosage_data.recommended_dose || 0);
                                                        const display = document.getElementById('calc-result');
                                                        if (display) display.innerText = `${result.toFixed(0)}${product.dosage_data.unit || 'g'}`;
                                                    }}
                                                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                                                />
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontSize: '0.8rem', color: '#065F46' }}>Dose Sugerida:</p>
                                                <p id="calc-result" style={{ fontSize: '1.5rem', fontWeight: '800', color: '#065F46' }}>0{product.dosage_data.unit || 'g'}</p>
                                            </div>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', marginTop: '8px', color: '#065F46', opacity: 0.8 }}>
                                            * Baseado na indicação de {product.dosage_data.recommended_dose}{product.dosage_data.unit}/{product.dosage_data.base_unit || 'm³'}.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
