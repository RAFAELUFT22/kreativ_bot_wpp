import { Link, useNavigate } from 'react-router-dom';

export default function Categories() {
    const navigate = useNavigate();

    return (
        <div className="mobile-page-wrapper">
            {/* Custom Mobile Header */}
            <div className="mobile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h1 className="mobile-header-title">Categorias</h1>
                <Link to="/ajuda" className="help-link">Ajuda</Link>
            </div>

            <div className="container" style={{ padding: '1rem', paddingBottom: '80px' }}>
                <div className="search-bar" style={{ marginTop: '0.5rem' }}>
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Buscar produtos..." />
                </div>

                <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '0.2rem' }}>Explore por Departamento</h2>
                    <p style={{ fontSize: '0.85rem', color: '#6B7280' }}>Encontre tudo o que sua piscina precisa</p>
                </div>

                <div className="dept-cards-list">
                    {/* Item 1 */}
                    <div className="dept-card bg-shape-1">
                        <div className="dept-card-content">
                            <div className="dept-icon-circle bg-blue-100">
                                <span>🧹</span>
                            </div>
                            <h3 className="dept-title">Manutenção</h3>
                            <p className="dept-desc">Cloro, algicidas e tudo para manter a água cristalina.</p>
                            <Link to="/produtos?categoria=manutencao" className="dept-link">Ver Produtos →</Link>
                        </div>
                        <div className="dept-image placeholder-bucket"></div>
                    </div>

                    {/* Item 2 */}
                    <div className="dept-card bg-shape-2">
                        <div className="dept-card-content">
                            <div className="dept-icon-circle bg-cyan-100">
                                <span>🔲</span>
                            </div>
                            <h3 className="dept-title">Construção</h3>
                            <p className="dept-desc">Revestimentos, pastilhas, iluminação e acabamentos.</p>
                            <Link to="/produtos?categoria=construcao" className="dept-link">Ver Produtos →</Link>
                        </div>
                        <div className="dept-image placeholder-pool"></div>
                    </div>

                    {/* Item 3 */}
                    <div className="dept-card bg-shape-3">
                        <div className="dept-card-content">
                            <div className="dept-icon-circle bg-indigo-100">
                                <span>⚙️</span>
                            </div>
                            <h3 className="dept-title">Equipamentos</h3>
                            <p className="dept-desc">Bombas, filtros, aquecedores e automação.</p>
                            <Link to="/produtos?categoria=equipamentos" className="dept-link">Ver Produtos →</Link>
                        </div>
                        <div className="dept-image placeholder-pump"></div>
                    </div>

                    {/* Item 4 */}
                    <div className="dept-card bg-shape-4">
                        <div className="dept-card-content">
                            <div className="dept-icon-circle bg-teal-100">
                                <span>🏊</span>
                            </div>
                            <h3 className="dept-title">Acessórios</h3>
                            <p className="dept-desc">Escovas, aspiradores, boias e cascatas.</p>
                            <Link to="/produtos?categoria=acessorios" className="dept-link">Ver Produtos →</Link>
                        </div>
                        <div className="dept-image placeholder-net"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
