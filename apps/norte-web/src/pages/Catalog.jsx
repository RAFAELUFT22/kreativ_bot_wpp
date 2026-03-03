import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import ProductCard from '../components/ProductCard';

export default function Catalog({ sessionId, updateSession, updateCartCount }) {
    const [searchParams, setSearchParams] = useSearchParams();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState(searchParams.get('category') || '');
    const [search, setSearch] = useState('');
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        loadCategories();
    }, []);

    useEffect(() => {
        loadProducts();
    }, [activeCategory, search]);

    async function loadCategories() {
        try {
            const result = await api.getCategories();
            setCategories(result.data);
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    async function loadProducts() {
        setLoading(true);
        try {
            const params = {};
            if (activeCategory) params.category = activeCategory;
            if (search) params.search = search;
            const result = await api.getProducts(params);
            setProducts(result.data);
        } catch (err) {
            console.error('Error loading products:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleAddToCart(product) {
        try {
            const result = await api.addToCart({
                session_id: sessionId || undefined,
                product_id: product.id,
                quantity: 1,
            });

            if (result.data.session_id && !sessionId) {
                updateSession(result.data.session_id);
            }

            updateCartCount(result.data.item_count);
            setFeedback(`✅ ${product.name} adicionado!`);
            setTimeout(() => setFeedback(''), 2000);
        } catch (err) {
            console.error('Error adding to cart:', err);
            setFeedback('❌ Erro ao adicionar');
            setTimeout(() => setFeedback(''), 2000);
        }
    }

    function selectCategory(cat) {
        setActiveCategory(cat);
        if (cat) setSearchParams({ category: cat });
        else setSearchParams({});
    }

    return (
        <section className="section">
            <div className="container">
                <h1 className="section__title">Nossos Produtos</h1>
                <p className="section__subtitle">Encontre tudo para manter sua piscina limpa e cristalina</p>

                {/* Search */}
                <div style={{ maxWidth: 500, margin: '0 auto var(--space-lg)' }}>
                    <input
                        type="search"
                        className="form-input"
                        placeholder="🔍 Buscar produto..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                {/* Category Pills */}
                <div className="category-pills">
                    <button
                        className={`category-pill ${!activeCategory ? 'active' : ''}`}
                        onClick={() => selectCategory('')}
                    >
                        Todos
                    </button>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
                            onClick={() => selectCategory(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Feedback Toast */}
                {feedback && (
                    <div style={{
                        position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
                        background: 'var(--bg-card)', border: '1px solid var(--color-primary)',
                        borderRadius: 'var(--radius-lg)', padding: 'var(--space-sm) var(--space-lg)',
                        zIndex: 200, boxShadow: 'var(--shadow-lg)', animation: 'fadeInUp 0.3s ease'
                    }}>
                        {feedback}
                    </div>
                )}

                {/* Product Grid */}
                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : products.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state__icon">🔍</div>
                        <h3 className="empty-state__title">Nenhum produto encontrado</h3>
                        <p className="empty-state__text">Tente outra busca ou categoria</p>
                    </div>
                ) : (
                    <div className="product-grid">
                        {products.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={handleAddToCart}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
