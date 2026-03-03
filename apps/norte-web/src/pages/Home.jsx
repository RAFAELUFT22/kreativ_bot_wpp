import { Link } from 'react-router-dom';

export default function Home() {
    return (
        <div className="home-page theme-summer">
            <div className="container" style={{ padding: '1rem' }}>
                {/* Search Bar */}
                <div className="search-bar">
                    <span className="search-icon">🔍</span>
                    <input type="text" placeholder="Buscar cloro, filtros, bombas..." />
                </div>

                {/* Hero Banner with Mascot */}
                <div className="hero-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '0.5rem' }}>
                    <div style={{ flex: 1, zIndex: 2 }}>
                        <span className="hero-badge">DESDE 2014</span>
                        <h1 className="hero-title">Qualidade e confiança para sua piscina</h1>
                        <p className="hero-subtitle">Fale com nosso especialista agora mesmo!</p>
                        <Link to="/produtos" className="btn-comprar">Ver Produtos</Link>
                    </div>
                    <div style={{ width: '130px', flexShrink: 0, display: 'flex', justifyContent: 'center', zIndex: 1 }}>
                        <img src="/assets_new/Hidronaldo/Hidroazul_Pose_E_FLAT.png" alt="Mascote Especialista" style={{ height: '140px', objectFit: 'contain', marginBottom: '-2rem' }} />
                    </div>
                </div>

                {/* Categories */}
                <div className="section-header">
                    <h2 className="section-title">Categorias</h2>
                    <Link to="/categorias" className="see-all">Ver todas</Link>
                </div>
                <div className="categories-row">
                    <Link to="/produtos?categoria=manutencao" className="category-item">
                        <div className="category-icon-wrapper"><span className="category-icon">🧹</span></div>
                        <span className="category-label">Manutenção</span>
                    </Link>
                    <Link to="/produtos?categoria=bombas" className="category-item">
                        <div className="category-icon-wrapper"><span className="category-icon">⚙️</span></div>
                        <span className="category-label">Bombas</span>
                    </Link>
                    <Link to="/produtos?categoria=quimicos" className="category-item">
                        <div className="category-icon-wrapper"><span className="category-icon">🧪</span></div>
                        <span className="category-label">Químicos</span>
                    </Link>
                    <Link to="/produtos?categoria=lazer" className="category-item">
                        <div className="category-icon-wrapper"><span className="category-icon">🏖️</span></div>
                        <span className="category-label">Lazer</span>
                    </Link>
                </div>

                {/* Ofertas Especiais with Caramelo Mascot */}
                <div className="special-offer" style={{ overflow: 'hidden', position: 'relative' }}>
                    <div className="offer-content" style={{ position: 'relative', zIndex: 2 }}>
                        <div className="offer-tag">☀️ OFERTAS ESPECIAIS</div>
                        <h3 className="offer-title">Verão Norte</h3>
                        <p className="offer-desc">Kits de limpeza e cloro com até 20% de desconto.</p>
                        <Link to="/produtos?oferta=verao" className="offer-btn">Ver Ofertas</Link>
                    </div>
                    <div style={{ position: 'absolute', right: '-10px', bottom: '-20px', zIndex: 1, opacity: 0.9 }}>
                        <img src="/assets_new/Caramelo/Caramelo_Pose_A_FLAT_1.png" alt="Mascote Cachorro Caramelo" style={{ height: '130px', objectFit: 'contain' }} />
                    </div>
                </div>

                {/* Destaques da Semana */}
                <div className="section-header">
                    <h2 className="section-title">Destaques da Semana</h2>
                </div>
                <div className="highlights-scroll">
                    <div className="highlight-card">
                        <div className="card-image placeholder-gold">
                            <span className="discount-badge">-15%</span>
                        </div>
                        <div className="card-info">
                            <h4 className="card-title">Cloro Granulado 1...</h4>
                            <p className="card-brand">Genco</p>
                            <div className="card-bottom">
                                <span className="card-price">Sob consulta</span>
                                <button className="add-btn">📱</button>
                            </div>
                        </div>
                    </div>
                    <div className="highlight-card">
                        <div className="card-image placeholder-gold"></div>
                        <div className="card-info">
                            <h4 className="card-title">Peneira Cata Folha</h4>
                            <p className="card-brand">Plástica Reforçada</p>
                            <div className="card-bottom">
                                <span className="card-price">Sob consulta</span>
                                <button className="add-btn">📱</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* O que dizem os clientes */}
                <div className="section-header" style={{ alignItems: 'center' }}>
                    <h2 className="section-title">O que dizem os clientes</h2>
                    <div className="review-icon-header">💬</div>
                </div>
                <div className="reviews-summary" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '1rem' }}>
                    <span style={{ color: '#FBBF24', fontSize: '1rem' }}>★★★★★</span> <b>4.8</b> de 5 no <b>Google</b>
                </div>

                <div className="reviews-list">
                    <div className="review-item">
                        <div className="reviewer-avatar" style={{ background: '#F3E8FF', color: '#9333EA' }}>MA</div>
                        <div className="review-content">
                            <div className="review-top">
                                <span className="reviewer-name">Maria A.</span>
                                <span className="review-time">Há 2 dias</span>
                            </div>
                            <div className="review-stars" style={{ color: '#FBBF24' }}>★★★★★</div>
                            <p className="review-text">Atendimento excelente! A entrega em Palmas foi super rápida. Recomendo muito.</p>
                        </div>
                    </div>
                    <div className="review-item">
                        <div className="reviewer-avatar" style={{ background: '#DCFCE7', color: '#16A34A' }}>JO</div>
                        <div className="review-content">
                            <div className="review-top">
                                <span className="reviewer-name">João O.</span>
                                <span className="review-time">Há 1 semana</span>
                            </div>
                            <div className="review-stars" style={{ color: '#FBBF24' }}>★★★★<span style={{ color: '#D1D5DB' }}>★</span></div>
                            <p className="review-text">Preços justos e produtos de qualidade. O técnico me ajudou a escolher o filtro certo.</p>
                        </div>
                    </div>
                </div>

                <Link to="#todas-avaliacoes" className="btn-outline full-width-btn">Ver todas as avaliações</Link>

            </div>
        </div>
    );
}
