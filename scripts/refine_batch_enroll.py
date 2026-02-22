import json

path = '/root/ideias_app/n8n-workflows/60-kreativ-api-ultimate.json'
with open(path, 'r') as f:
    wf = json.load(f)

for node in wf['nodes']:
    if node['name'] == 'Admin: Batch Enroll':
        node['parameters']['query'] = """WITH enrolled AS (
    INSERT INTO students (phone, name, course_id, current_module, portal_token)
    SELECT telefone_whatsapp, nome_completo, {{ $json.course_id || '(SELECT id FROM courses LIMIT 1)' }}, 1, encode(gen_random_bytes(16), 'hex')
    FROM pre_inscriptions
    WHERE id::text = ANY(ARRAY{{ JSON.stringify($json.ids) }})
    ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
    RETURNING phone, name
)
UPDATE pre_inscriptions 
SET convertido = true, student_id = (SELECT id FROM students WHERE phone = pre_inscriptions.telefone_whatsapp LIMIT 1)
WHERE id::text = ANY(ARRAY{{ JSON.stringify($json.ids) }});

SELECT count(*) as total_enrolled FROM pre_inscriptions WHERE id::text = ANY(ARRAY{{ JSON.stringify($json.ids) }});"""

with open(path, 'w') as f:
    json.dump(wf, f, indent=2)

print("Refined Batch Enroll logic in n8n workflow.")
