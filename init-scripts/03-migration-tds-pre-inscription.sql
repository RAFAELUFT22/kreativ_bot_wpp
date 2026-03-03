CREATE TABLE IF NOT EXISTS pre_inscriptions_tds (
    id SERIAL PRIMARY KEY,
    -- Bloco 1: Identificação
    nome_completo TEXT NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    municipio TEXT,
    bairro_assentamento TEXT,
    estado TEXT DEFAULT 'Tocantins',
    curso_escolhido TEXT,
    data_entrevista DATE DEFAULT CURRENT_DATE,
    
    -- Bloco 2: Perfil Sociodemográfico
    sexo TEXT,
    idade INTEGER,
    estado_civil TEXT,
    num_pessoas_domicilio INTEGER,
    num_criancas INTEGER,
    num_adolescentes INTEGER,
    num_idosos INTEGER,
    cor_raca TEXT,
    quilombola BOOLEAN,
    escolaridade TEXT,
    
    -- Bloco 3: Situação Social
    inscrito_cadunico TEXT, -- Sim, Não, Não sei
    beneficios_sociais JSONB, -- Array de benefícios
    casa_possui JSONB, -- Água, Luz, etc
    
    -- Bloco 4: Ocupação e Renda
    situacao_ocupacional TEXT,
    renda_pessoal_faixa TEXT,
    renda_pessoal_valor NUMERIC(10,2),
    renda_familiar_faixa TEXT,
    renda_familiar_valor NUMERIC(10,2),
    
    -- Bloco 5: Atividade Produtiva
    desenvolve_atividade_produtiva BOOLEAN,
    tipo_atividade_produtiva JSONB, -- Agro, Artesanato, etc
    agro_area_ha NUMERIC(10,2),
    agro_produtos TEXT,
    agro_possui_dap_caf BOOLEAN,
    agro_destino_producao JSONB,
    agro_renda_mensal_valor NUMERIC(10,2),
    dificuldades_produzir JSONB,
    dificuldades_vender JSONB,
    
    -- Bloco 6: Crédito
    possui_conta_bancaria BOOLEAN,
    possui_conta_digital BOOLEAN,
    tomou_microcredito TEXT,
    interesse_credito_produtivo BOOLEAN,
    finalidade_credito TEXT,
    
    -- Bloco 7: Território e Políticas Públicas
    organizacoes_locais JSONB,
    organizacoes_locais_desc TEXT,
    acessou_politica_publica BOOLEAN,
    politicas_acessadas JSONB,
    forma_acesso_politica TEXT,
    conhece_outras_politicas TEXT,
    dificuldades_acesso_politica JSONB,
    opiniao_politica_diferenca TEXT,
    acredita_projeto_ajuda TEXT,
    curso_mercado_trabalho TEXT,
    curso_atividade_produtiva TEXT,
    
    -- Metadados de segurança
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    telefone_contato TEXT
);

CREATE INDEX IF NOT EXISTS idx_tds_cpf ON pre_inscriptions_tds(cpf);
CREATE INDEX IF NOT EXISTS idx_tds_municipio ON pre_inscriptions_tds(municipio);
