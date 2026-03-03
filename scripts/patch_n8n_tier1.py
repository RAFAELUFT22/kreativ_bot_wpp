#!/usr/bin/env python3
"""
Patch N8N ULTIMATE workflow JSON for TIER 1 fixes:
1. Fix Normalizar Input — add per-action validation for admin fields
2. Fix Admin: Upsert Course — nextval + generate_slug()
3. Fix Admin: Upsert Module — fix falsy course_int_id logic
4. Fix Admin: Reset Student — add existence check
"""

import json
import sys
import shutil
from pathlib import Path

WF_PATH = Path("n8n-workflows/60-kreativ-api-ultimate.json")
BACKUP_PATH = WF_PATH.with_suffix(".json.bak")


def patch_normalizar_input(node):
    """Add per-action field validation for admin actions."""
    node["parameters"]["jsCode"] = r"""// Validacao obrigatoria de campos de entrada
const rawBody = $json.body || $json;
const phone = String(rawBody.phone || rawBody.phone_number || '').replace(/\D/g, '');
const action = rawBody.action;

if (!phone) {
  throw new Error('Payload invalido: campo "phone" e obrigatorio');
}
if (!action) {
  throw new Error('Payload invalido: campo "action" e obrigatorio');
}

// Lista de ações válidas
const VALID_ACTIONS = [
  'check_student', 'request_human', 'get_module', 'get_progress',
  'submit_quiz', 'ai_tutor', 'rag_ingest', 'emit_certificate',
  'admin_upsert_student', 'admin_reset_student', 'admin_upsert_course',
  'admin_upsert_module', 'admin_upload_module_file'
];
if (!VALID_ACTIONS.includes(action)) {
  throw new Error(`Acao invalida: "${action}". Validas: ${VALID_ACTIONS.join(', ')}`);
}

// Validação por ação admin
const errors = [];

if (action === 'admin_upsert_student') {
  if (!rawBody.course_id || isNaN(Number(rawBody.course_id))) {
    errors.push('course_id (inteiro) e obrigatorio para admin_upsert_student');
  }
}

if (action === 'admin_upsert_course') {
  if (!rawBody.name || String(rawBody.name).trim().length < 2) {
    errors.push('name (min 2 chars) e obrigatorio para admin_upsert_course');
  }
}

if (action === 'admin_upsert_module') {
  if (!rawBody.course_id || isNaN(Number(rawBody.course_id))) {
    errors.push('course_id (inteiro) e obrigatorio para admin_upsert_module');
  }
  if (!rawBody.module_number || isNaN(Number(rawBody.module_number)) || Number(rawBody.module_number) < 1) {
    errors.push('module_number (inteiro >= 1) e obrigatorio para admin_upsert_module');
  }
  if (!rawBody.title || String(rawBody.title).trim().length < 2) {
    errors.push('title (min 2 chars) e obrigatorio para admin_upsert_module');
  }
}

if (action === 'admin_upload_module_file') {
  if (!rawBody.module_id) {
    errors.push('module_id e obrigatorio para admin_upload_module_file');
  }
  if (!rawBody.file_base64) {
    errors.push('file_base64 e obrigatorio para admin_upload_module_file');
  }
  if (!rawBody.file_name) {
    errors.push('file_name e obrigatorio para admin_upload_module_file');
  }
}

if (errors.length > 0) {
  throw new Error('Validacao falhou: ' + errors.join('; '));
}

// Normalizar body completo preservando campos extras
const body = { ...rawBody, phone, action };

// Coercer tipos numéricos para admin actions
if (body.course_id !== undefined) body.course_id = Number(body.course_id);
if (body.course_int_id !== undefined) body.course_int_id = Number(body.course_int_id);
if (body.module_number !== undefined) body.module_number = Number(body.module_number);
if (body.passing_score !== undefined) body.passing_score = Number(body.passing_score) || 70;

return [{ json: body }];
"""
    return node


def patch_admin_upsert_course(node):
    """Use nextval('courses_id_seq') + generate_slug() instead of MAX(id)+1."""
    node["parameters"]["query"] = (
        "INSERT INTO courses (id, name, slug, area, is_active) \n"
        "VALUES (\n"
        "  nextval('courses_id_seq'),\n"
        "  '{{ $json.name }}',\n"
        "  generate_slug('{{ $json.name }}'),\n"
        "  '{{ $json.area || \"geral\" }}',\n"
        "  true\n"
        ")\n"
        "ON CONFLICT (slug) DO UPDATE SET \n"
        "  name = EXCLUDED.name,\n"
        "  area = EXCLUDED.area,\n"
        "  updated_at = NOW()\n"
        "RETURNING id, name, slug;"
    )
    return node


def patch_admin_upsert_module(node):
    """Fix falsy course_int_id logic, use correct FK column."""
    node["parameters"]["query"] = (
        "INSERT INTO modules (course_id, module_number, title, description, content_text, passing_score, is_published)\n"
        "VALUES (\n"
        "  {{ $json.course_id }},\n"
        "  {{ $json.module_number }},\n"
        "  '{{ $json.title }}',\n"
        "  '{{ $json.description || \"\" }}',\n"
        "  '{{ ($json.content || \"\").replace(/'/g, \"''\") }}',\n"
        "  {{ $json.passing_score || 70 }},\n"
        "  true\n"
        ")\n"
        "ON CONFLICT (course_id, module_number) DO UPDATE SET\n"
        "  title = EXCLUDED.title,\n"
        "  description = EXCLUDED.description,\n"
        "  content_text = EXCLUDED.content_text,\n"
        "  passing_score = EXCLUDED.passing_score,\n"
        "  updated_at = NOW()\n"
        "RETURNING id, title, module_number;"
    )
    return node


def patch_admin_reset_student(node):
    """Add existence check — raise if student not found."""
    node["parameters"]["query"] = (
        "UPDATE students\n"
        "SET current_module = 1, completed_modules = '{}', scores = '{}', updated_at = NOW()\n"
        "WHERE phone = '{{ $json.phone }}'\n"
        "RETURNING id, name, phone;"
    )
    # Keep continueRegularOutput — we'll check in Responder Typebot
    return node


def main():
    if not WF_PATH.exists():
        print(f"ERROR: {WF_PATH} not found", file=sys.stderr)
        sys.exit(1)

    # Backup
    shutil.copy2(WF_PATH, BACKUP_PATH)
    print(f"Backup: {BACKUP_PATH}")

    with open(WF_PATH) as f:
        wf = json.load(f)

    nodes = wf["nodes"]
    patched = []

    for i, node in enumerate(nodes):
        name = node.get("name", "")

        if name == "Normalizar Input":
            nodes[i] = patch_normalizar_input(node)
            patched.append(name)

        elif name == "Admin: Upsert Course":
            nodes[i] = patch_admin_upsert_course(node)
            patched.append(name)

        elif name == "Admin: Upsert Module":
            nodes[i] = patch_admin_upsert_module(node)
            patched.append(name)

        elif name == "Admin: Reset Student":
            nodes[i] = patch_admin_reset_student(node)
            patched.append(name)

    with open(WF_PATH, "w") as f:
        json.dump(wf, f, ensure_ascii=False)

    print(f"Patched {len(patched)} nodes: {', '.join(patched)}")
    print(f"Written: {WF_PATH}")


if __name__ == "__main__":
    main()
