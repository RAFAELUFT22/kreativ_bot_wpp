import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

const STATUS_MAP = {
    quote_sent: { label: 'Orçamento Enviado', class: 'pending', icon: '📋' },
    awaiting_confirmation: { label: 'Aguardando Confirmação', class: 'pending', icon: '⏳' },
    awaiting_payment: { label: 'Aguardando Pagamento', class: 'pending', icon: '💰' },
    awaiting_operator: { label: 'Verificando Pedido', class: 'processing', icon: '🔍' },
    payment_confirmed: { label: 'Pagamento Confirmado', class: 'confirmed', icon: '✅' },
    processing: { label: 'Preparando Entrega', class: 'processing', icon: '📦' },
    out_for_delivery: { label: 'Saiu para Entrega', class: 'processing', icon: '🚚' },
    delivered: { label: 'Entregue', class: 'delivered', icon: '🎉' },
    cancelled: { label: 'Cancelado', class: 'cancelled', icon: '❌' },
};

export default function OrderStatus() {
    const { orderNumber } = useParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => { loadOrder(); }, [orderNumber]);

    async function loadOrder() {
        setLoading(true);
        try {
            const result = await api.getOrderByNumber(orderNumber);
            setOrder(result.data);
        } catch (err) {
            console.error('Error loading order:', err);
        } finally {
            setLoading(false);
        }
    }

    const formatPrice = (v) => "Sob consulta";

    if (loading) return <div className="loading"><div className="spinner"></div></div>;

    if (!order) {
        return (
            <section className="order-status">
                <div className="container">
                    <div className="empty-state">
                        <div className="empty-state__icon">🔍</div>
                        <h2 className="empty-state__title">Pedido não encontrado</h2>
                        <p className="empty-state__text">Verifique o número do pedido e tente novamente</p>
                        <Link to="/" className="btn btn-primary">Voltar ao Início</Link>
                    </div>
                </div>
            </section>
        );
    }

    const status = STATUS_MAP[order.status] || { label: order.status, class: 'pending', icon: '📋' };

    return (
        <section className="order-status">
            <div className="container">
                <div className="order-status__card">
                    <div style={{ fontSize: '3rem', marginBottom: 'var(--space-md)' }}>{status.icon}</div>

                    <h2 style={{ marginBottom: 'var(--space-sm)' }}>Pedido {order.order_number}</h2>

                    <span className={`status-badge ${status.class}`}>{status.label}</span>

                    <div style={{ margin: 'var(--space-xl) 0', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-lg)' }}>
                        <h3 style={{ marginBottom: 'var(--space-md)', fontWeight: 600 }}>Itens do Pedido</h3>
                        {order.items && order.items.map(item => (
                            <div key={item.id} style={{
                                display: 'flex', justifyContent: 'space-between',
                                padding: 'var(--space-sm) 0', borderBottom: '1px solid var(--border-color)',
                                fontSize: 'var(--font-size-sm)'
                            }}>
                                <span>{item.quantity}x {item.name}</span>
                                <span style={{ fontWeight: 600 }}>{formatPrice(item.total)}</span>
                            </div>
                        ))}
                    </div>

                    <div style={{ textAlign: 'left', marginBottom: 'var(--space-lg)' }}>
                        <div className="cart-summary__row">
                            <span>Subtotal</span><span>{formatPrice(order.subtotal)}</span>
                        </div>
                        {parseFloat(order.delivery_fee) > 0 && (
                            <div className="cart-summary__row">
                                <span>Entrega</span><span>{formatPrice(order.delivery_fee)}</span>
                            </div>
                        )}
                        {parseFloat(order.discount) > 0 && (
                            <div className="cart-summary__row">
                                <span>Desconto</span><span style={{ color: 'var(--color-success)' }}>-{formatPrice(order.discount)}</span>
                            </div>
                        )}
                        <div className="cart-summary__row total">
                            <span>Total</span><span>{formatPrice(order.total)}</span>
                        </div>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                        Criado em {new Date(order.created_at).toLocaleString('pt-BR')}
                    </p>

                    <div style={{ marginTop: 'var(--space-xl)', display: 'flex', gap: 'var(--space-md)', justifyContent: 'center' }}>
                        <Link to="/" className="btn btn-secondary">Voltar ao Início</Link>
                        <a href="https://wa.me/" target="_blank" rel="noopener noreferrer" className="btn btn-success">
                            💬 Falar no WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}
