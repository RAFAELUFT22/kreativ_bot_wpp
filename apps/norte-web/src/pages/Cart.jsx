import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Cart({ sessionId, updateCartCount }) {
    const navigate = useNavigate();
    const [cart, setCart] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { if (sessionId) loadCart(); else setLoading(false); }, [sessionId]);

    async function loadCart() {
        setLoading(true);
        try {
            const result = await api.getCart(sessionId);
            setCart(result.data);
            updateCartCount(result.data.item_count);
        } catch {
            setCart(null);
        } finally {
            setLoading(false);
        }
    }

    async function handleUpdateQty(itemId, qty) {
        try {
            const result = await api.updateCartItem(sessionId, itemId, qty);
            setCart(result.data);
            updateCartCount(result.data.item_count);
        } catch (err) { console.error(err); }
    }

    async function handleRemove(itemId) {
        try {
            const result = await api.removeCartItem(sessionId, itemId);
            setCart(result.data);
            updateCartCount(result.data.item_count);
        } catch (err) { console.error(err); }
    }

    const formatPrice = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    if (!cart || !cart.items || cart.items.length === 0) {
        return (
            <section className="cart-page">
                <div className="container">
                    <div className="empty-state">
                        <div className="empty-state__icon">🛒</div>
                        <h2 className="empty-state__title">Seu carrinho está vazio</h2>
                        <p className="empty-state__text">Adicione produtos ao carrinho para continuar</p>
                        <Link to="/produtos" className="btn btn-primary">Ver Produtos</Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="cart-page">
            <div className="container">
                <h1 className="section__title" style={{ textAlign: 'left', marginBottom: 'var(--space-xl)' }}>
                    🛒 Carrinho ({cart.item_count} {cart.item_count === 1 ? 'item' : 'itens'})
                </h1>

                <div className="grid-2">
                    {/* Cart Items */}
                    <div>
                        {cart.items.map(item => (
                            <div key={item.id} className="cart-item">
                                <img className="cart-item__image" src={item.image_url || ''} alt={item.name}
                                    onError={(e) => { e.target.style.display = 'none'; }} />
                                <div className="cart-item__info">
                                    <div className="cart-item__name">{item.name}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{item.category}</div>
                                    <div className="cart-item__price">{formatPrice(item.unit_price)}</div>
                                </div>
                                <div className="cart-item__qty">
                                    <button onClick={() => handleUpdateQty(item.id, item.quantity - 1)}>−</button>
                                    <span style={{ minWidth: 24, textAlign: 'center' }}>{item.quantity}</span>
                                    <button onClick={() => handleUpdateQty(item.id, item.quantity + 1)}>+</button>
                                </div>
                                <div style={{ fontWeight: 600, color: 'var(--color-primary)', minWidth: 80, textAlign: 'right' }}>
                                    {formatPrice(item.total)}
                                </div>
                                <button className="cart-item__remove" onClick={() => handleRemove(item.id)}>✕</button>
                            </div>
                        ))}
                    </div>

                    {/* Summary */}
                    <div>
                        <div className="cart-summary">
                            <h3 style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>Resumo do Pedido</h3>
                            <div className="cart-summary__row">
                                <span>Subtotal</span>
                                <span>A combinar</span>
                            </div>
                            <div className="cart-summary__row">
                                <span>Entrega</span>
                                <span style={{ color: 'var(--text-muted)' }}>A combinar</span>
                            </div>
                            <div className="cart-summary__row total">
                                <span>Total</span>
                                <span>A combinar</span>
                            </div>
                            <button
                                className="btn btn-primary btn-lg btn-full"
                                style={{ marginTop: 'var(--space-lg)' }}
                                onClick={() => window.open('https://wa.me/5563999999999', '_blank')}
                            >
                                Consultar via WhatsApp →
                            </button>
                            <Link to="/produtos"
                                className="btn btn-secondary btn-full"
                                style={{ marginTop: 'var(--space-sm)', textAlign: 'center', display: 'block' }}
                            >
                                Continuar Comprando
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
