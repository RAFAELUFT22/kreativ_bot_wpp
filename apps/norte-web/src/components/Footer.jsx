export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer__grid">
                    <div className="footer__col">
                        <h4>🏊 Norte Piscinas</h4>
                        <p>Tudo para sua piscina no coração do Tocantins. Entregas grátis em Palmas para compras acima de R$100.</p>
                        <p style={{ marginTop: '1rem' }}>
                            <a href="https://instagram.com/nortepiscinaspalmas" target="_blank" rel="noreferrer">📸 @nortepiscinaspalmas</a>
                        </p>
                    </div>
                    <div className="footer__col">
                        <h4>Categorias</h4>
                        <a href="/produtos?categoria=manutencao">Manutenção</a>
                        <a href="/produtos?categoria=construcao">Construção</a>
                        <a href="/produtos?categoria=equipamentos">Equipamentos</a>
                        <a href="/produtos?categoria=acessorios">Acessórios</a>
                    </div>
                    <div className="footer__col">
                        <h4>📍 Loja Centro</h4>
                        <p>106 Sul, Av. JK, 24<br />Palmas - TO</p>
                        <a href="https://wa.me/556332241533">📱 (63) 3224-1533</a>
                    </div>
                    <div className="footer__col">
                        <h4>📍 Loja Plano Sul</h4>
                        <p>ARSO 52, 505 Sul, Lote 15<br />Palmas - TO</p>
                        <a href="https://wa.me/556330265995">📱 (63) 3026-5995</a>
                    </div>
                </div>
                <div className="footer__bottom">
                    © {new Date().getFullYear()} Norte Piscinas (CNPJ: 19.542.012/0001-76). Qualidade e confiança desde 2014.
                </div>
            </div>
        </footer>
    );
}
