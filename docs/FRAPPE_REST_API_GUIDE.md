# Guia de Referência: Frappe REST API (v14/v15)

Este documento descreve os padrões de integração com o Frappe LMS para o projeto Kreativ Educação.

## 1. Autenticação
**Método:** API Key / API Secret (Token-based)
**Header:** 
```http
Authorization: token {{FRAPPE_API_KEY}}:{{FRAPPE_API_SECRET}}
```

## 2. Operações com Recursos (/api/resource)

### Criar um Documento (POST)
- **URL:** `{{base_url}}/api/resource/{{DocType}}`
- **Body:** JSON com os campos do Doctype.
- **Child Tables:** Inseridas como listas dentro do objeto principal.

### Listar com Filtros (GET)
- **URL:** `{{base_url}}/api/resource/{{DocType}}?fields=["name","title"]&filters=[["published","=",1]]`
- **Operadores comuns:** `=`, `!=`, `like`, `>`, `<`, `in`, `between`.

### Atualizar (PUT)
- **URL:** `{{base_url}}/api/resource/{{DocType}}/{{name}}`
- **Body:** Apenas os campos a serem alterados.

## 3. Upload de Arquivos
- **URL:** `POST {{base_url}}/api/method/upload_file`
- **Content-Type:** `multipart/form-data`
- **Campos:**
  - `file`: O binário do arquivo.
  - `doctype`: (Opcional) Vincular ao Doctype.
  - `docname`: (Opcional) Vincular ao nome do documento.
  - `is_private`: 0 ou 1.

## 4. Integração N8N (Dicas)
- Sempre utilize o nó **HTTP Request**.
- Configure a autenticação via **Header Parameters**.
- Use o operador `json.dumps()` nas expressões para garantir que os filtros sejam enviados como strings JSON válidas.

---
*Gerado automaticamente pelo Gemini CLI em 03/03/2026.*
