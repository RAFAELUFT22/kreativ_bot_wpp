import requests
import json
import os

# Configurações do Frappe
FRAPPE_URL = "https://lms.extensionista.site"
API_KEY = "24c8f8aba4e1783"
API_SECRET = "4cdd3ec9c24eb9f"

headers = {
    "Authorization": f"token {API_KEY}:{API_SECRET}",
    "Content-Type": "application/json"
}

courses_data = [
    {
        "title": "Gestão Financeira para Empreendimentos",
        "description": "Aprenda a controlar caixa, custos, receitas e margens para tomar decisões assertivas no seu negócio.",
        "chapters": [
            {
                "title": "Chapter 1 – Fundamentos Financeiros",
                "lessons": [
                    {"title": "O que é gestão financeira para empreendedor?", "content": """### Introdução à Gestão Financeira

Gestão financeira é o conjunto de processos, métodos e ferramentas que permitem a uma empresa controlar suas finanças. Para o empreendedor, isso significa saber exatamente quanto dinheiro entra, quanto sai e, o mais importante, quanto sobra.

**Por que é importante?**
- Evita a quebra por falta de caixa.
- Permite planejar investimentos.
- Ajuda a separar o dinheiro pessoal do dinheiro da empresa."""},
                    {"title": "Receita, custo, despesa e lucro", "content": """### Entendendo os Termos

1. **Receita**: Tudo o que entra no caixa através das vendas.
2. **Custo**: Gastos ligados diretamente à produção (ex: matéria-prima).
3. **Despesa**: Gastos fixos para manter a empresa aberta (ex: aluguel).
4. **Lucro**: O que sobra da receita após pagar todos os custos e despesas."""},
                    {"title": "Conceitos: margem, markup, ponto de equilíbrio", "content": """### Indicadores de Sucesso

- **Margem de Lucro**: Qual a porcentagem de lucro em cada venda.
- **Markup**: Índice aplicado sobre o custo para chegar ao preço de venda.
- **Ponto de Equilíbrio**: O quanto você precisa vender apenas para empatar as contas (zero lucro, zero prejuízo)."""}
                ]
            },
            {
                "title": "Chapter 2 – Planejamento Financeiro",
                "lessons": [
                    {"title": "Controle de caixa básico (fluxo de caixa)", "content": """### O Fluxo de Caixa

O fluxo de caixa é o registro de todas as entradas e saídas de dinheiro em um período. 

**Dica de Ouro**: Nunca deixe de registrar nem um centavo. O descontrole começa nos pequenos gastos."""},
                    {"title": "Planejando despesas fixas e variáveis", "content": """### Fixas vs Variáveis

- **Fixas**: Aquelas que não mudam se você vender mais ou menos (Internet, Aluguel).
- **Variáveis**: Mudam conforme a produção (Embalagens, Comissão de vendas)."""}
                ]
            }
        ]
    },
    {
        "title": "Boas Práticas na Produção e Manipulação de Alimentos",
        "description": "Guia essencial sobre segurança, higiene e procedimentos para manipulação correta de alimentos.",
        "chapters": [
            {
                "title": "Chapter 1 – Fundamentos de Segurança Alimentar",
                "lessons": [
                    {"title": "Por que boas práticas são obrigatórias?", "content": """### Segurança em Primeiro Lugar

As Boas Práticas de Fabricação (BPF) são obrigatórias por lei e essenciais para garantir que o alimento não cause doenças ao consumidor. Um erro na manipulação pode destruir a reputação de um negócio."""},
                    {"title": "Tipos de contaminação", "content": """### Os 3 Perigos

1. **Física**: Cabelos, pedras, pedaços de plástico.
2. **Química**: Resíduos de produtos de limpeza.
3. **Biológica**: Fungos, bactérias e vírus."""}
                ]
            },
            {
                "title": "Chapter 2 – Higiene Pessoal e Ambiental",
                "lessons": [
                    {"title": "Boa higiene pessoal", "content": """### O Manipulador

- Unhas curtas e sem esmalte.
- Uso de touca e uniforme limpo.
- Lavagem das mãos a cada troca de tarefa."""},
                    {"title": "Limpeza e sanitização", "content": """### Ambiente Seguro

Limpar é tirar a sujeira visível. Sanitizar é eliminar os microrganismos. Use sempre produtos autorizados pela ANVISA."""}
                ]
            }
        ]
    },
    {
        "title": "Organização da Produção para o Mercado",
        "description": "Estruture seus processos produtivos para atender a demanda de forma eficiente e organizada.",
        "chapters": [
            {
                "title": "Chapter 1 – Entendendo o Mercado",
                "lessons": [
                    {"title": "Identificar demanda e nicho", "content": """### Para quem você produz?

Entender o seu nicho é o primeiro passo para organizar a produção. Você produz em massa ou sob encomenda? Quem é seu cliente ideal?"""},
                    {"title": "Estudar concorrência e público-alvo", "content": """### Conheça o Terreno

Analise o que seus concorrentes entregam e como você pode fazer melhor ou de forma mais eficiente."""}
                ]
            },
            {
                "title": "Chapter 2 – Fluxo de Produção",
                "lessons": [
                    {"title": "Mapeando o processo produtivo", "content": """### O Fluxograma

Desenhe o caminho do product: da entrada da matéria-prima até a entrega ao cliente. Visualize cada etapa para identificar desperdícios."""}
                ]
            }
        ]
    }
]

def create_doc(doctype, data):
    url = f"{FRAPPE_URL}/api/resource/{doctype}"
    try:
        response = requests.post(url, headers=headers, json=data)
        if response.status_code == 200:
            return response.json()["data"]
        else:
            print(f"Erro ao criar {doctype}: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Exceção ao criar {doctype}: {str(e)}")
        return None

for c in courses_data:
    print(f"Criando curso: {c['title']}...")
    course = create_doc("LMS Course", {
        "title": c["title"],
        "short_introduction": c["description"],
        "description": f"<p>{c['description']}</p>",
        "published": 1,
        "status": "Published",
        "card_gradient": "Blue",
        "category": "Business",
        "currency": "BRL",
        "instructors": [{"instructor": "Administrator"}]
    })
    
    if course:
        course_name = course["name"]
        for i, ch in enumerate(c["chapters"]):
            print(f"  Criando capítulo: {ch['title']}...")
            chapter = create_doc("Course Chapter", {
                "title": ch["title"],
                "course": course_name,
                "idx": i + 1
            })
            
            if chapter:
                chapter_name = chapter["name"]
                for j, le in enumerate(ch["lessons"]):
                    print(f"    Criando lição: {le['title']}...")
                    create_doc("Course Lesson", {
                        "title": le["title"],
                        "chapter": chapter_name,
                        "course": course_name,
                        "body": le["content"],
                        "content": '{"blocks": []}',
                        "published": 1,
                        "idx": j + 1
                    })

print("Processo concluído!")
