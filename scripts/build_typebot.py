#!/usr/bin/env python3
"""Build and deploy the Kreativ Typebot flow (12 groups) via API.

Usage:
    pip3 install requests   # if not already installed
    python3 scripts/build_typebot.py
"""
import json, requests, sys

# ─── Config ──────────────────────────────────────────────────────────────
BOT_ID  = "vnp6x9bqwrx54b2pct5dhqlb"
API_KEY = "LqkFiNhRjg1p2W3nNkgLpxPM"
BASE    = "https://typebot.extensionista.site/api/v1"
N8N_URL = "https://n8n.extensionista.site/webhook/kreativ-unified-api"
CT_HDR  = [{"key": "Content-Type", "value": "application/json"}]
H       = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}

# ─── Block helpers ────────────────────────────────────────────────────────

def tx(bid, text, out_eid=None):
    """Text bubble."""
    b = {"id": bid, "type": "text",
         "content": {"richText": [{"type": "p", "children": [{"text": text}]}]}}
    if out_eid:
        b["outgoingEdgeId"] = out_eid
    return b

def inp(bid, var_id, ph="Digite aqui...", btn="Enviar"):
    """Text input — collects user text into a variable."""
    return {"id": bid, "type": "text input",
            "options": {"variableId": var_id,
                        "labels": {"placeholder": ph, "button": btn}}}

def choice(bid, items):
    """Button choice. items = [(item_id, label, edge_id), ...]"""
    return {"id": bid, "type": "choice input",
            "items": [{"id": iid, "content": lbl, "outgoingEdgeId": eid}
                      for iid, lbl, eid in items],
            "options": {"isMultipleChoice": False}}

def wb(bid, action, extra_body, mappings, out_eid=None):
    """HTTP Request (webhook) to N8N unified API.
    mappings = {"variable_name": "json.path.in.response", ...}
    """
    body = {"action": action, "phone": "{{remoteJid}}", **extra_body}
    b = {"id": bid, "type": "webhook",
         "options": {
             "webhook": {"method": "POST", "url": N8N_URL,
                         "headers": CT_HDR, "body": json.dumps(body)},
             "isAdvancedConfig": True, "isCustomBody": True,
             "responseVariableMapping": [
                 {"id": f"m_{bid}_{k[:6]}", "variableName": k, "dataPath": v}
                 for k, v in mappings.items()
             ]
         }}
    if out_eid:
        b["outgoingEdgeId"] = out_eid
    return b

def cond(bid, var_id, value, true_item_id, true_eid, else_eid, op="Equal to"):
    """Condition block. True path → true_eid, Else path → else_eid."""
    return {"id": bid, "type": "Condition",
            "items": [{"id": true_item_id, "outgoingEdgeId": true_eid,
                       "content": {"logicalOperator": "AND",
                                   "comparisons": [{"id": f"c_{bid}",
                                                    "variableId": var_id,
                                                    "comparisonOperator": op,
                                                    "value": value}]}}],
            "outgoingEdgeId": else_eid}

# ─── Edge helpers ─────────────────────────────────────────────────────────

def edge(eid, from_bid, to_gid, item_id=None):
    """Edge from a block (or choice/condition item) to a group."""
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

# ─── Variables (persisted per session) ────────────────────────────────────

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
}

variables = [{"id": vid, "name": name, "isSessionVariable": True}
             for name, vid in V.items()]

# ─── Groups ───────────────────────────────────────────────────────────────

groups = []
edges  = []

# ── g_start: mandatory start group ───────────────────────────────────────
groups.append(group("g_start", "Start", -200, 0, [
    {"id": "b_start", "type": "start", "label": "Start",
     "outgoingEdgeId": "e_start_g1"}
]))
edges += [
    edge_ev("e_ev_start", "ev_start", "g_start"),
    edge("e_start_g1", "b_start", "g1"),
]

# ── g1: Catraca — check_student + route by status ────────────────────────
# Blocks run sequentially: load msg → webhook → condition
# Condition: if status="human" → g9; else → g2
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

# ── g2: Menu principal ────────────────────────────────────────────────────
groups.append(group("g2", "Menu", 500, 0, [
    tx("b_g2_greet",
       "Olá, {{student_name}}! 👋\nMódulo atual: *{{current_module}}*\nO que deseja fazer?"),
    choice("b_g2_menu", [
        ("i_opt_mod",   "📚 Acessar meu módulo",      "e_opt_mod"),
        ("i_opt_prog",  "📊 Ver meu progresso",        "e_opt_prog"),
        ("i_opt_ai",    "🤖 Perguntar ao Tutor IA",    "e_opt_ai"),
        ("i_opt_human", "🆘 Falar com tutor humano",   "e_opt_human"),
    ]),
]))
edges += [
    edge("e_opt_mod",   "b_g2_menu", "g3", "i_opt_mod"),
    edge("e_opt_prog",  "b_g2_menu", "g5", "i_opt_prog"),
    edge("e_opt_ai",    "b_g2_menu", "g7", "i_opt_ai"),
    edge("e_opt_human", "b_g2_menu", "g6", "i_opt_human"),
]

# ── g3: Módulo — fetch content + show questions ───────────────────────────
# After showing Q1, jump to g4 for user input
groups.append(group("g3", "Módulo", 900, -400, [
    tx("b_g3_load", "📥 Carregando módulo, aguarde alguns segundos..."),
    wb("b_g3_get", "get_module", {"module_number": "{{current_module}}"}, {
        "module_title":   "title",
        "module_content": "content_text",
        "question_1":     "question_1",
        "question_2":     "question_2",
        "question_3":     "question_3",
    }),
    tx("b_g3_title", "📖 *{{module_title}}*"),
    tx("b_g3_body",  "{{module_content}}"),
    tx("b_g3_q1",    "❓ *Pergunta 1:*\n{{question_1}}", "e_g3_g4"),
]))
edges.append(edge("e_g3_g4", "b_g3_q1", "g4"))

# ── g4: Quiz — collect 3 answers + submit + evaluate ─────────────────────
# Blocks run sequentially. After condition:
#   passed → g8 (certificate)
#   failed → g4_fail (encouragement)
groups.append(group("g4", "Quiz", 1300, -400, [
    inp("b_g4_a1", V["answer_1"], "Sua resposta para a P1...", "Responder"),
    tx("b_g4_q2",  "❓ *Pergunta 2:*\n{{question_2}}"),
    inp("b_g4_a2", V["answer_2"], "Sua resposta para a P2...", "Responder"),
    tx("b_g4_q3",  "❓ *Pergunta 3:*\n{{question_3}}"),
    inp("b_g4_a3", V["answer_3"], "Sua resposta para a P3...", "Enviar respostas"),
    tx("b_g4_eval", "🤔 Avaliando com IA, aguarde..."),
    wb("b_g4_submit", "submit_quiz", {
        "module_number": "{{current_module}}",
        "question_1": "{{question_1}}", "answer_1": "{{answer_1}}",
        "question_2": "{{question_2}}", "answer_2": "{{answer_2}}",
        "question_3": "{{question_3}}", "answer_3": "{{answer_3}}",
    }, {
        "quiz_passed":    "passed",
        "quiz_score":     "score",
        "quiz_feedback":  "feedback",
        "next_module":    "next_module",
        "is_last_module": "is_last_module",
    }),
    cond("b_g4_cond", V["quiz_passed"], "true",
         "i_g4_passed", "e_g4_passed", "e_g4_failed"),
]))
edges += [
    edge("e_g4_passed", "b_g4_cond", "g8",      "i_g4_passed"),
    edge("e_g4_failed", "b_g4_cond", "g4_fail"),
]

# ── g4_fail: Quiz failed — show feedback + return to menu ─────────────────
groups.append(group("g4_fail", "Quiz — Resultado", 1600, -200, [
    tx("b_g4f_msg",
       "💪 Pontuação: *{{quiz_score}}*\n\n{{quiz_feedback}}\n\nNão desanime! Revise o conteúdo e tente novamente.",
       "e_g4f_g2"),
]))
edges.append(edge("e_g4f_g2", "b_g4f_msg", "g2"))

# ── g5: Progresso ─────────────────────────────────────────────────────────
groups.append(group("g5", "Progresso", 900, 0, [
    wb("b_g5_get", "get_progress", {}, {
        "progress_pct":   "completion_pct",
        "current_module": "current_module",
        "student_name":   "name",
    }),
    tx("b_g5_show",
       "📊 *Seu Progresso*\n\nNome: {{student_name}}\nMódulo atual: {{current_module}}\nConcluído: {{progress_pct}}%",
       "e_g5_g2"),
]))
edges.append(edge("e_g5_g2", "b_g5_show", "g2"))

# ── g6: Tutor Humano — request handoff + pause bot ────────────────────────
# After the webhook, bot will be paused by Evolution API.
# The last text block is a terminal message (no outgoing edge).
groups.append(group("g6", "Tutor Humano", 900, 400, [
    tx("b_g6_load", "🆘 Solicitando tutor humano..."),
    wb("b_g6_req", "request_human", {}, {}),
    tx("b_g6_msg",
       "✅ Transferindo para nosso tutor!\n\nUm atendente estará com você em breve. "
       "O bot está pausado durante o atendimento.\n\nAté logo! 👋"),
]))

# ── g7: AI Tutor — ask question + get answer + return to menu ─────────────
groups.append(group("g7", "AI Tutor", 900, 800, [
    tx("b_g7_lbl", "🤖 *Tutor IA — Kreativ*\nQual é sua dúvida sobre o conteúdo?"),
    inp("b_g7_ask", V["tutor_question"], "Sua pergunta...", "Perguntar"),
    wb("b_g7_req", "ai_tutor", {"message": "{{tutor_question}}"}, {
        "ai_response": "response",
    }),
    tx("b_g7_resp", "🤖 {{ai_response}}", "e_g7_g2"),
]))
edges.append(edge("e_g7_g2", "b_g7_resp", "g2"))

# ── g8: Certificado — emit + show link + return to menu ───────────────────
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

# ── g9: Modo Humano — terminal message (bot paused) ───────────────────────
groups.append(group("g9", "Modo Humano", 500, 600, [
    tx("b_g9_msg",
       "👨‍💼 Você está em atendimento humano.\n\n"
       "Aguarde nosso tutor. O bot voltará automaticamente quando o atendimento encerrar."),
]))

# ─── Events ──────────────────────────────────────────────────────────────
events = [
    {"id": "ev_start", "type": "start",
     "graphCoordinates": {"x": -400, "y": 50},
     "outgoingEdgeId": "e_ev_start"}
]

# ─── Deploy ──────────────────────────────────────────────────────────────
payload = {
    "typebot": {
        "groups":    groups,
        "variables": variables,
        "edges":     edges,
        "events":    events,
    }
}

print(f"Building: {len(groups)} groups, {len(edges)} edges, {len(variables)} variables")
print("Sending PATCH to Typebot API...")

r = requests.patch(f"{BASE}/typebots/{BOT_ID}", headers=H, json=payload)
print(f"PATCH Status: {r.status_code}")

if not r.ok:
    print("❌ Error:", r.text[:600])
    sys.exit(1)

print("✅ Bot structure updated!")

# Publish
print("Publishing bot...")
p = requests.post(f"{BASE}/typebots/{BOT_ID}/publish", headers=H, json={})
print(f"Publish: {p.status_code} {'✅' if p.ok else '❌ ' + p.text[:200]}")

if p.ok:
    print("\n🚀 Bot live at: https://bot.extensionista.site/kreativ-educacao")
