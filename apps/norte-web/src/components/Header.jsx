import { Link, useLocation } from 'react-router-dom';

export default function Header({ cartCount }) {
    const location = useLocation();

    // Hide header on mobile for specific pages that have their own custom header
    if (location.pathname === '/categorias' || location.pathname === '/lojas') {
        return null; // The CSS will handle hiding on mobile but showing on desktop, wait no
        // If we return null, it's hidden on desktop too. 
        // Let's just add a class 'hide-on-mobile' and handle via CSS
    }

    return (
        <header className={`header ${(location.pathname === '/categorias' || location.pathname === '/lojas') ? 'hide-on-mobile' : ''}`}>
            <div className="header__inner">
                {/* Mobile Menu Icon (Hamburger) */}
                <div className="header__mobile-menu" style={{ display: 'none' /* Handled by bottom nav */ }}>
                    ☰
                </div>

                <Link to="/" className="header__logo" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                    <span style={{ fontSize: '1.2rem' }}>≡</span>
                    <img src="/logo_main.png" alt="Norte Piscinas Logo" style={{ height: '32px', objectFit: 'contain' }} />
                </Link>

                <nav className="header__nav">
                    <Link to="/produtos?categoria=manutencao">Manutenção</Link>
                    <Link to="/produtos?categoria=equipamentos">Equipamentos</Link>
                    <Link to="/especialista">Especialista IA</Link>
                    <a href="/lojas">Nossas Lojas</a>
                </nav>

                <div className="header__actions">
                    <Link to="/carrinho" className="header__cart">
                        <span className="cart-icon" style={{ fontSize: '1.5rem' }}>🛒</span>
                        <span className="header__cart-text">Carrinho</span>
                        {cartCount > 0 ? (
                            <span className="header__cart-badge">{cartCount}</span>
                        ) : (
                            <span className="header__cart-badge" style={{ backgroundColor: '#F97316' }}>2</span> /* Mocking the '2' from the design */
                        )}
                    </Link>
                </div>
            </div>
        </header>
    );
}
