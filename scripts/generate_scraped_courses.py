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

# Dados validados via Web Scrapping + IA (Sebrae/Anvisa/Senai)
courses_data = [
    {
        "title": "Mestre da Gestão: Finanças e Lucratividade",
        "description": "Domine o fluxo de caixa, precificação estratégica e garanta a saúde financeira do seu pequeno negócio com o método Sebrae.",
        "category": "Business",
        "chapters": [
            {
                "title": "Capítulo 1: O Coração das Finanças - Fluxo de Caixa",
                "lessons": [
                    {"title": "O que é e por que fazer?", "content": """### Fluxo de Caixa: O Pulmão da Empresa

O fluxo de caixa é o registro diário de todas as entradas (vendas) e saídas (pagamentos) de dinheiro. Sem ele, você não sabe se teve lucro ou apenas 'girou' dinheiro.

**Dica de Ouro:** Nunca misture sua conta pessoal com a da empresa. Anote cada centavo, mesmo pequenas despesas, para saber se o negócio 'respira' ou está sufocado."""},
                    {"title": "Passo a Passo do Registro Diário", "content": """### Como registrar corretamente

1. **Saldo Inicial:** Quanto dinheiro tem no caixa/banco ao abrir o dia.
2. **Entradas:** Vendas à vista, recebimentos de cartão e Pix.
3. **Saídas:** Pagamentos de fornecedores, luz, internet, pro-labore.
4. **Saldo Final:** Entradas menos saídas. Deve bater com o que tem no bolso/banco."""}
                ]
            },
            {
                "title": "Capítulo 2: Precificação e Margem de Lucro",
                "lessons": [
                    {"title": "Como Definir o Preço de Venda", "content": """### A Fórmula do Preço Certo

O seu preço deve cobrir quatro pilares essenciais:
1. **Custos Variáveis:** Ingredientes, matéria-prima e embalagens.
2. **Custos Fixos:** Aluguel, luz, água e salários.
3. **Impostos:** O que você paga ao governo (ex: DAS do MEI).
4. **Margem de Lucro:** O valor que sobra para a empresa reinvestir.

**Atenção:** Não olhe apenas o preço do concorrente; entenda seus próprios custos para não pagar para trabalhar."""},
                    {"title": "Entendendo a Margem de Lucro", "content": """### Lucro vs. Faturamento

Faturamento é tudo o que você vende. Lucro é o que sobra depois de pagar TUDO.
Uma margem saudável permite que você tenha uma reserva para emergências e capital para expandir seu negócio."""}
                ]
            }
        ]
    },
    {
        "title": "Segurança Alimentar: Guia Prático ANVISA 2025",
        "description": "Aprenda as normas da RDC 216 da ANVISA para manipulação segura de alimentos, evitando contaminações e garantindo a qualidade.",
        "category": "Business",
        "chapters": [
            {
                "title": "Capítulo 1: Higiene e Manipulação Profissional",
                "lessons": [
                    {"title": "Higiene Pessoal e do Ambiente", "content": """### O Manipulador de Alimentos

*   **Lavagem de mãos:** Obrigatória ao chegar, após usar o banheiro, tossir ou manipular lixo. Use sabão líquido e papel toalha.
*   **Uniforme:** Sempre limpo, de cor clara. Cabelos protegidos por rede ou touca.
*   **Conduta:** Sem anéis, brincos ou relógios. Proibido falar, cantar ou espirrar sobre a comida."""},
                    {"title": "Evitando a Contaminação Cruzada", "content": """### Perigo Invisível

A contaminação cruzada ocorre quando micróbios de um alimento cru passam para um pronto através de utensílios ou mãos.

**Como evitar:** Use tábuas e facas diferentes para carnes cruas e vegetais. Lave sempre os utensílios entre um preparo e outro."""}
                ]
            },
            {
                "title": "Capítulo 2: Temperaturas e Armazenamento",
                "lessons": [
                    {"title": "A Zona de Perigo (5°C a 60°C)", "content": """### Controle de Temperatura

Os micróbios se multiplicam rapidamente entre 5°C e 60°C.
*   **Alimentos Frios:** Devem ser mantidos abaixo de 5°C.
*   **Alimentos Quentes:** Devem ser mantidos acima de 60°C por no máximo 6 horas.
*   **Cozimento:** O centro do alimento deve atingir 70°C para eliminar bactérias."""},
                    {"title": "Regra PVPS no Estoque", "content": """### Organização Inteligente

**PVPS:** Primeiro que Vence, Primeiro que Sai.
Organize sua geladeira e despensa colocando os produtos com data de validade mais próxima à frente. Isso evita desperdício e garante a segurança do cliente."""}
                ]
            }
        ]
    },
    {
        "title": "Eficiência Operacional: Produção para o Mercado",
        "description": "Organize seu fluxo de trabalho, elimine gargalos e aumente sua produtividade usando métodos industriais aplicados a pequenos negócios.",
        "category": "Business",
        "chapters": [
            {
                "title": "Capítulo 1: Capacidade e Mapeamento",
                "lessons": [
                    {"title": "Calculando sua Capacidade Produtiva", "content": """### Quanto você realmente consegue entregar?

Capacidade produtiva é o máximo que você produz em um tempo determinado.
**Exercício Prático:** Cronometre quanto tempo leva para fazer um pedido completo. Multiplique pelas horas de trabalho e considere pausas. Isso evita aceitar encomendas que você não conseguirá entregar."""},
                    {"title": "Mapeando o Fluxo de Trabalho", "content": """### Do Pedido à Entrega

Desenhe o caminho que o produto faz. Identifique os 'gargalos' (etapas onde o trabalho acumula). Eliminar uma tarefa desnecessária pode economizar horas na sua semana."""}
                ]
            },
            {
                "title": "Capítulo 2: Ferramentas de Organização",
                "lessons": [
                    {"title": "Método Kanban para Pequenos Negócios", "content": """### Organização Visual (Cartões)

Use um quadro com três colunas:
1.  **Para Fazer:** Pedidos novos que aguardam início.
2.  **Fazendo:** O que está sendo produzido agora.
3.  **Feito:** Prontos para entrega ou entrega realizada.

Isso evita esquecimentos e mantém a prioridade das entregas sempre visível."""},
                    {"title": "Gestão de Desperdícios (O Método 5S)", "content": """### Ambiente Organizado, Mente Ágil

Aplique os sensos de utilização, ordenação e limpeza. Um ambiente de trabalho bagunçado gera perda de tempo procurando ferramentas e aumenta o risco de acidentes e erros na produção."""}
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
        "card_gradient": "Orange" if "Segurança" in c["title"] else "Green" if "Mestre" in c["title"] else "Teal",
        "category": c["category"],
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

print("\nCursos gerados com sucesso baseados em conteúdo validado!")
