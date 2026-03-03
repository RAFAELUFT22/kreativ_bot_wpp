import { useNavigate } from 'react-router-dom';

export default function ProductCard({ product, onAddToCart }) {
    const navigate = useNavigate();
    const imageUrl = product.image_url || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220"><rect fill="%231E293B" width="300" height="220"/><text x="150" y="110" text-anchor="middle" fill="%2364748B" font-size="40">🏊</text></svg>';

    const formatPrice = (value) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    return (
        <div className="product-card" onClick={() => navigate(`/produto/${product.id}`)}>
            <img
                className="product-card__image"
                src={imageUrl}
                alt={product.name}
                loading="lazy"
                onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 220"><rect fill="%231E293B" width="300" height="220"/><text x="150" y="110" text-anchor="middle" fill="%2364748B" font-size="40">🏊</text></svg>'; }}
            />
            <div className="product-card__body">
                <div className="product-card__category">{product.category}</div>
                <div className="product-card__name">{product.name}</div>
                <div className="product-card__price">
                    <span className="product-card__price-current">Sob consulta</span>
                </div>
            </div>
            <div className="product-card__actions">
                <button
                    className="btn btn-primary btn-sm btn-full"
                    onClick={(e) => { e.stopPropagation(); window.open('https://wa.me/5563999999999', '_blank'); }}
                >
                    💬 Consultar
                </button>
            </div>
        </div>
    );
}
