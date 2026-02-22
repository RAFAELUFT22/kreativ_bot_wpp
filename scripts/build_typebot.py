#!/usr/bin/env python3
"""Build and deploy the Kreativ Typebot flow via DB injection.

Deploy strategy:
  - PATCH API rejects "Webhook" (capital W) via Zod validation
  - Solution: UPDATE Typebot + PublicTypebot tables directly in typebot_db
  - Then POST /publish to bump version/cache

WhatsApp button support (Evolution API v2.2.3 + Cloud API Meta):
  - Text blocks with [buttons] syntax → interactive button messages
  - When user taps button: interactive.button_reply.title → conversation var
  - So menu_choice variable = BUTTON TITLE (e.g. "Meu Módulo")
  - Use Contains conditions to route

Usage:
    python3 scripts/build_typebot.py
"""
import json, requests, subprocess, sys

# ─── Config ──────────────────────────────────────────────────────────────────
BOT_ID     = "vnp6x9bqwrx54b2pct5dhqlb"
PUB_BOT_ID = "cmlvjfr7v000ipc1giknwf999"
API_KEY    = "LqkFiNhRjg1p2W3nNkgLpxPM"
BASE       = "https://typebot.extensionista.site/api/v1"
N8N_URL    = "https://n8n.extensionista.site/webhook/kreativ-unified-api"
# Headers for Webhook blocks (id field is required by Typebot v6 viewer)
CT_HDR = [{"id": "h_ct", "key": "Content-Type", "value": "application/json"}]
H = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# ─── DB injection helper ──────────────────────────────────────────────────────

def psql(sql):
    """Run SQL in typebot_db via docker exec."""
    r = subprocess.run(
        ["docker", "exec", "kreativ_postgres", "psql", "-U", "kreativ_user",
         "-d", "typebot_db", "-c", sql],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        print("SQL error:", r.stderr[:300])
        sys.exit(1)
    return r.stdout

# ─── Block helpers ────────────────────────────────────────────────────────────

def tx(bid, text, out_eid=None):
    """Text bubble. Supports [buttons] and [list] syntax for interactive WA messages."""
    b = {"id": bid, "type": "text",
         "content": {"richText": [{"type": "p", "children": [{"text": text}]}]}}
    if out_eid:
        b["outgoingEdgeId"] = out_eid
    return b

def inp(bid, var_id, ph="Digite aqui...", btn="Enviar"):
    """Text input — captures user text (or button/list reply title) into a variable."""
    return {"id": bid, "type": "text input",
            "options": {"variableId": var_id,
                        "labels": {"placeholder": ph, "button": btn}}}

def wb(bid, action, extra_body, mappings, out_eid=None):
    """HTTP Request block (server-side) to N8N unified API.

    CRITICAL: type='Webhook' (capital W) = server-side execution in Typebot v6.
    'webhook' (lowercase) = client-side listener → Evolution API v2.2.3 IGNORES IT.

    bodyPath uses 'data.<field>' prefix (Typebot wraps HTTP response as {data: <body>}).
    Uses variableId (not variableName) per Typebot v6 schema.
    Requires id field on webhook options and each header (Typebot v6 validator).
    """
    body = {"action": action, "phone": "{{remoteJid}}", **extra_body}
    b = {"id": bid, "type": "Webhook",
         "options": {
             "webhook": {
                 "id": f"wh_{bid}",
                 "method": "POST",
                 "url": N8N_URL,
                 "headers": CT_HDR,
                 "body": json.dumps(body),
             },
             "isCustomBody": True,
             "isExecutedOnClient": False,
             "responseVariableMapping": [
                 {"id": f"m_{bid}_{k[:6]}", "variableId": V[k], "bodyPath": f"data.{v}"}
                 for k, v in mappings.items()
                 if k in V
             ]
         }}
    if out_eid:
        b["outgoingEdgeId"] = out_eid
    return b

def cond(bid, var_id, value, true_item_id, true_eid, else_eid=None, op="Equal to"):
    """Condition block.
    True path  → true_eid (edge to group)
    False path → else_eid (edge to group) or next block in group if else_eid=None
    """
    b = {"id": bid, "type": "Condition",
         "items": [{"id": true_item_id, "outgoingEdgeId": true_eid,
                    "content": {"logicalOperator": "AND",
                                "comparisons": [{"id": f"c_{bid}",
                                                 "variableId": var_id,
                                                 "comparisonOperator": op,
                                                 "value": value}]}}]}
    if else_eid:
        b["outgoingEdgeId"] = else_eid
    return b

def edge(eid, from_bid, to_gid, item_id=None):
    """Edge from a block (or condition/choice item) to a group."""
    frm = {"blockId": from_bid}
    if item_id:
        frm["itemId"] = item_id
    return {"id": eid, "from": frm, "to": {"groupId": to_gid}}

def edge_ev(eid, ev_id, to_gid):
    """Edge from the start event to the first group."""
    return {"id": eid, "from": {"eventId": ev_id}, "to": {"groupId": to_gid}}

def group(gid, title, x, y, blocks):
    return {"id": gid, "title": title,
            "graphCoordinates": {"x": x, "y": y},
            "blocks": blocks}

# ─── Variables ────────────────────────────────────────────────────────────────

V = {
    "phone":            "v_phone",
    "remoteJid":        "v_remoteJid",   # pre-filled by Evolution API
    "student_status":   "v_status",
    "student_name":     "v_name",
    "current_module":   "v_cur_mod",
    "is_last_module":   "v_is_last",
    "course_completed": "v_crs_done",
    "module_title":     "v_mod_title",
    "module_content":   "v_mod_body",
    "question_1":       "v_q1",
    "question_2":       "v_q2",
    "question_3":       "v_q3",
    "answer_1":         "v_a1",
    "answer_2":         "v_a2",
    "answer_3":         "v_a3",
    "quiz_passed":      "v_passed",
    "quiz_score":       "v_score",
    "quiz_feedback":    "v_feedback",
    "next_module":      "v_next_mod",
    "cert_url":         "v_cert_url",
    "cert_module":      "v_cert_mod",
    "progress_pct":     "v_pct",
    "ai_response":      "v_ai_resp",
    "tutor_question":   "v_tutor_q",
    "menu_choice":      "v_menu",        # captures button/list reply title
    "quiz_raw_answer":  "v_quiz_raw",    # Captura todas as respostas em um bloco
}

variables = [{"id": vid, "name": name, "isSessionVariable": True}
             for name, vid in V.items()]

# ─── [buttons] text templates ─────────────────────────────────────────────────
# Evolution API v2 parses [buttons] tag → sends as interactive button message
# Max 3 reply buttons per message (Cloud API Meta limit)
# When user taps a button: evolution maps interactive.button_reply.title → conversation
# So menu_choice = button displayText (e.g. "Meu Módulo")

MENU_PRINCIPAL = (
    "[buttons]\n"
    "[title]Kreativ Educação\n"
    "[description]Olá, {{student_name}}! Módulo atual: {{current_module}}\n"
    "[footer]O que deseja fazer?\n"
    "[reply]\n"
    "displayText: Meu Módulo\n"
    "id: modulo\n"
    "[reply]\n"
    "displayText: Meu Progresso\n"
    "id: progresso\n"
    "[reply]\n"
    "displayText: Suporte\n"
    "id: suporte\n"
)

MENU_SUPORTE = (
    "[buttons]\n"
    "[title]Suporte Kreativ\n"
    "[description]Como posso te ajudar?\n"
    "[footer]Kreativ Educação\n"
    "[reply]\n"
    "displayText: Tutor IA\n"
    "id: ai\n"
    "[reply]\n"
    "displayText: Tutor Humano\n"
    "id: humano\n"
    "[reply]\n"
    "displayText: Voltar ao Menu\n"
    "id: voltar\n"
)

# ─── Groups ───────────────────────────────────────────────────────────────────

groups = []
edges  = []

# ── g_start: mandatory start group ───────────────────────────────────────────
groups.append(group("g_start", "Start", -200, 0, [
    {"id": "b_start", "type": "start", "label": "Start",
     "outgoingEdgeId": "e_start_g1"}
]))
edges += [
    edge_ev("e_ev_start", "ev_start", "g_start"),
    edge("e_start_g1", "b_start", "g1"),
]

# ── g1: Catraca — verifica cadastro e redireciona ─────────────────────────────
groups.append(group("g1", "Catraca", 100, 0, [
    tx("b_g1_load", "⏳ Verificando seu acesso..."),
    wb("b_g1_check", "check_student", {}, {
        "student_status":   "status",
        "student_name":     "first_name",
        "current_module":   "current_module",
        "is_last_module":   "is_last_module",
        "course_completed": "course_completed",
    }),
    cond("b_g1_cond", V["student_status"], "human",
         "i_g1_human", "e_g1_human", "e_g1_bot"),
]))
edges += [
    edge("e_g1_human", "b_g1_cond", "g9", "i_g1_human"),
    edge("e_g1_bot",   "b_g1_cond", "g2"),
]

# ── g2: Menu Principal — botões interativos nativos WhatsApp ──────────────────
# Blocos sequenciais:
# 1. Text com [buttons] → Evolution envia como interactive button message
# 2. Text Input captura a resposta (título do botão tocado)
# 3. Conditions sequenciais (false path = None → próximo bloco do grupo)
groups.append(group("g2", "Menu", 500, 0, [
    tx("b_g2_menu", MENU_PRINCIPAL),
    inp("b_g2_inp", V["menu_choice"], "Ou digite uma opção...", "OK"),
    # Condition 1: Meu Módulo → g3 (false → próximo bloco)
    cond("b_g2_c1", V["menu_choice"], "Meu Módulo",
         "i_g2_mod", "e_g2_mod", None, op="Contains"),
    # Condition 2: Meu Progresso → g5 (false → próximo bloco)
    cond("b_g2_c2", V["menu_choice"], "Progresso",
         "i_g2_prog", "e_g2_prog", None, op="Contains"),
    # Condition 3: Suporte → g2_sup (false → voltar ao menu)
    cond("b_g2_c3", V["menu_choice"], "Suporte",
         "i_g2_sup", "e_g2_sup", "e_g2_back", op="Contains"),
]))
edges += [
    edge("e_g2_mod",  "b_g2_c1", "g3",    "i_g2_mod"),
    edge("e_g2_prog", "b_g2_c2", "g5",    "i_g2_prog"),
    edge("e_g2_sup",  "b_g2_c3", "g2_sup","i_g2_sup"),
    edge("e_g2_back", "b_g2_c3", "g2"),   # não reconhecido → mostra menu de novo
]

# ── g2_sup: Submenu Suporte ───────────────────────────────────────────────────
groups.append(group("g2_sup", "Submenu Suporte", 500, 600, [
    tx("b_g2s_menu", MENU_SUPORTE),
    inp("b_g2s_inp", V["menu_choice"], "Ou digite...", "OK"),
    cond("b_g2s_c1", V["menu_choice"], "Tutor IA",
         "i_g2s_ai",   "e_g2s_ai",   None, op="Contains"),
    cond("b_g2s_c2", V["menu_choice"], "Humano",
         "i_g2s_hum",  "e_g2s_hum",  None, op="Contains"),
    cond("b_g2s_c3", V["menu_choice"], "Voltar",
         "i_g2s_bck",  "e_g2s_bck",  "e_g2s_retry", op="Contains"),
]))
edges += [
    edge("e_g2s_ai",    "b_g2s_c1", "g7",     "i_g2s_ai"),
    edge("e_g2s_hum",   "b_g2s_c2", "g6",     "i_g2s_hum"),
    edge("e_g2s_bck",   "b_g2s_c3", "g2",     "i_g2s_bck"),
    edge("e_g2s_retry", "b_g2s_c3", "g2_sup"),
]

# ── g3: Módulo — busca conteúdo e exibe perguntas ─────────────────────────────
groups.append(group("g3", "Módulo", 900, -400, [
    tx("b_g3_load", "📥 Carregando módulo, aguarde..."),
    wb("b_g3_get", "get_module", {"module_number": "{{current_module}}"}, {
        "module_title":   "title",
        "module_content": "content",    # async: só title+content retornam síncronos
    }),
    tx("b_g3_title", "📖 *{{module_title}}*"),
    tx("b_g3_body",  "{{module_content}}"),
    tx("b_g3_quiz_wpp", "📝 *Quiz chegando!*\nPrepare-se para responder 3 perguntas sobre este conteúdo.", "e_g3_g4"),
]))
edges.append(edge("e_g3_g4", "b_g3_quiz_wpp", "g4"))

# ── g4: Quiz — coleta 3 respostas + submete + avalia ─────────────────────────
groups.append(group("g4", "Quiz", 1300, -400, [
    tx("b_g4_intro", "✍️ *Instruções:*\nLeia as perguntas abaixo e responda todas em uma única mensagem (pode ser texto livre, a IA vai avaliar seu entendimento)."),
    tx("b_g4_qs", "❓ *Perguntas:* \n\n1. {{question_1}}\n2. {{question_2}}\n3. {{question_3}}"),
    inp("b_g4_ans", V["quiz_raw_answer"], "Escreva suas respostas aqui...", "Enviar Avaliação"),
    tx("b_g4_eval", "🤔 Enviando suas respostas para correção..."),
    wb("b_g4_submit", "submit_quiz", {
        "module_number": "{{current_module}}",
        "answers": "{{quiz_raw_answer}}",
    }, {}),   # async: resultado chega via WhatsApp direto
    tx("b_g4_result", "✅ Respostas enviadas!\n\nO resultado chegará em instantes. Enquanto isso, você voltou ao menu principal.", "e_g4_g2"),
]))
edges.append(edge("e_g4_g2", "b_g4_result", "g2"))

# ── g4_fail: Quiz reprovado — feedback + voltar menu ─────────────────────────
groups.append(group("g4_fail", "Quiz — Reprovado", 1600, -200, [
    tx("b_g4f_msg",
       "💪 Pontuação: *{{quiz_score}}*\n\n{{quiz_feedback}}\n\nNão desanime! Revise o conteúdo e tente novamente.",
       "e_g4f_g2"),
]))
edges.append(edge("e_g4f_g2", "b_g4f_msg", "g2"))

# ── g5: Progresso ─────────────────────────────────────────────────────────────
groups.append(group("g5", "Progresso", 900, 0, [
    wb("b_g5_get", "get_progress", {}, {
        "progress_pct": "completion_pct",
        # student_name and current_module already set from g1 — don't overwrite with possibly-null values
    }),
    tx("b_g5_show",
       "📊 *Seu Progresso*\n\nNome: {{student_name}}\nMódulo atual: {{current_module}}\nConcluído: {{progress_pct}}%",
       "e_g5_g2"),
]))
edges.append(edge("e_g5_g2", "b_g5_show", "g2"))

# ── g6: Tutor Humano — handoff + pausa bot ────────────────────────────────────
groups.append(group("g6", "Tutor Humano", 900, 400, [
    tx("b_g6_load", "🆘 Solicitando tutor humano..."),
    wb("b_g6_req", "request_human", {}, {}),
    tx("b_g6_msg",
       "✅ Transferindo para nosso tutor!\n\nUm atendente estará com você em breve. "
       "O bot está pausado durante o atendimento.\n\nAté logo! 👋"),
]))

# ── g7: Tutor IA ───────────────────────────────────────────────────────────────
groups.append(group("g7", "Tutor IA", 900, 800, [
    tx("b_g7_lbl", "🤖 *Tutor IA — Kreativ*\nQual é sua dúvida sobre o conteúdo?"),
    inp("b_g7_ask", V["tutor_question"], "Sua pergunta...", "Perguntar"),
    wb("b_g7_req", "ai_tutor", {"message": "{{tutor_question}}"}, {}),  # async: resposta via WhatsApp
    tx("b_g7_resp", "Seu tutor responderá em instantes! 📱\n(A resposta chegará nesta conversa)", "e_g7_g2"),
]))
edges.append(edge("e_g7_g2", "b_g7_resp", "g2"))

# ── g8: Certificado ───────────────────────────────────────────────────────────
groups.append(group("g8", "Certificado", 1900, -400, [
    tx("b_g8_pass",
       "🎉 *Parabéns!* Pontuação: *{{quiz_score}}*\n\n{{quiz_feedback}}"),
    wb("b_g8_cert", "emit_certificate", {
        "module_number": "{{current_module}}",
    }, {
        "cert_url":    "cert_url",
        "cert_module": "module_name",
    }),
    tx("b_g8_show",
       "🏆 Certificado do módulo *{{cert_module}}* emitido!\n\n📜 Acesse: {{cert_url}}",
       "e_g8_g2"),
]))
edges.append(edge("e_g8_g2", "b_g8_show", "g2"))

# ── g9: Modo Humano — mensagem terminal (bot pausado) ────────────────────────
groups.append(group("g9", "Modo Humano", 500, 600, [
    tx("b_g9_msg",
       "👨‍💼 Você está em atendimento humano.\n\n"
       "Aguarde nosso tutor. O bot voltará automaticamente quando o atendimento encerrar."),
]))

# ─── Events ──────────────────────────────────────────────────────────────────
events = [
    {"id": "ev_start", "type": "start",
     "graphCoordinates": {"x": -400, "y": 50},
     "outgoingEdgeId": "e_ev_start"}
]

# ─── Deploy via DB injection ──────────────────────────────────────────────────
# PATCH API rejects "Webhook" (capital W) via Zod validation.
# Solution: UPDATE directly in typebot_db, then POST /publish to bump cache.

groups_json    = json.dumps(groups).replace("'", "''")
variables_json = json.dumps(variables).replace("'", "''")
edges_json     = json.dumps(edges).replace("'", "''")
events_json    = json.dumps(events).replace("'", "''")

print(f"Building: {len(groups)} groups, {len(edges)} edges, {len(variables)} variables")
print("Injecting directly into typebot_db...")

psql(f"""
UPDATE "Typebot"
SET groups='{groups_json}'::jsonb,
    variables='{variables_json}'::jsonb,
    edges='{edges_json}'::jsonb,
    events='{events_json}'::jsonb,
    "updatedAt"=NOW()
WHERE id='{BOT_ID}';
""")

psql(f"""
UPDATE "PublicTypebot"
SET groups='{groups_json}'::jsonb,
    variables='{variables_json}'::jsonb,
    edges='{edges_json}'::jsonb,
    events='{events_json}'::jsonb,
    "updatedAt"=NOW()
WHERE id='{PUB_BOT_ID}';
""")

# Clear stuck sessions
psql("""DELETE FROM "ChatSession" WHERE state->>'currentBlockId' LIKE 'b_g%';""")
print("✅ DB updated, sessions cleared")

# Publish via API to bump version/cache
print("Publishing bot...")
p = requests.post(f"{BASE}/typebots/{BOT_ID}/publish", headers=H, json={})
print(f"Publish: {p.status_code} {'✅' if p.ok else '❌ ' + p.text[:200]}")

if p.ok:
    print(f"\n🚀 Bot live at: https://bot.extensionista.site/kreativ-educacao")
    print("\nMenu buttons (Cloud API Meta):")
    print("  'Meu Módulo'  → g3 (conteúdo do módulo)")
    print("  'Meu Progresso' → g5 (progresso)")
    print("  'Suporte'     → g2_sup (submenu)")
    print("    'Tutor IA'  → g7")
    print("    'Tutor Humano' → g6 (handoff)")
    print("    'Voltar ao Menu' → g2")
