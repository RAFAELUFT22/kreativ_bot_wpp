import { Link, useLocation } from 'react-router-dom';

export default function MobileBottomNav() {
    const location = useLocation();

    return (
        <nav className="mobile-bottom-nav">
            <Link to="/" className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}>
                <div className="nav-icon">🏠</div>
                <span>Início</span>
            </Link>
            <Link to="/categorias" className={`nav-item ${location.pathname.startsWith('/categorias') ? 'active' : ''}`}>
                <div className="nav-icon">📁</div>
                <span>Categorias</span>
            </Link>
            <Link to="/lojas" className={`nav-item ${location.pathname.startsWith('/lojas') ? 'active' : ''}`}>
                <div className="nav-icon">📍</div>
                <span>Lojas</span>
            </Link>
            <Link to="/perfil" className={`nav-item ${location.pathname.startsWith('/perfil') ? 'active' : ''}`}>
                <div className="nav-icon">👤</div>
                <span>Perfil</span>
            </Link>
        </nav>
    );
}
