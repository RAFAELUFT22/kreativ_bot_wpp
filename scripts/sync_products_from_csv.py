import csv
import re
import os

# Paths
CSV_PATH = '/NORTE_PISCINAS/produtos_2026-02-24-23-59-11.csv'
DB_NAMES_CSV = '/tmp/db_names.csv'
OUTPUT_SQL = '/tmp/sync_products.sql'

def normalize(text):
    if text is None:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(text).lower())

def clean_decimal(text):
    if not text:
        return "0.00"
    # Convert Brazilian format (81,00) to standard (81.00)
    return text.replace('.', '').replace(',', '.')

def escape_sql(text):
    if not text:
        return ""
    return text.replace("'", "''")

def load_existing_products(db_csv):
    """Loads existing products from a CSV exported from the DB (id;sku;name)."""
    products_by_sku = {}
    products_by_name = {}
    
    try:
        with open(db_csv, 'r') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                p_id = row['id']
                sku = row['sku']
                name = row['name']
                
                if sku:
                    products_by_sku[normalize(sku)] = p_id
                if name:
                    products_by_name[normalize(name)] = p_id
        return products_by_sku, products_by_name
    except Exception as e:
        print(f"Error loading existing products: {e}")
        return {}, {}

def sync():
    existing_skus, existing_names = load_existing_products(DB_NAMES_CSV)
    updates = []
    
    try:
        # Note: encoding might be latin-1 if it's a Brazilian CSV export from Bling
        with open(CSV_PATH, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f, delimiter=';')
            print(f"DEBUG: CSV Headers detected: {reader.fieldnames}")
            rows = list(reader)
            print(f"DEBUG: Total records found in CSV: {len(rows)}")
            for i, row in enumerate(rows):
                # Try both with and without quotes just in case
                bling_id = row.get('ID') or row.get('"ID"', '')
                sku = (row.get('Código') or row.get('"Código"', '')).strip()
                name = (row.get('Descrição') or row.get('"Descrição"', '')).strip()
                unit = row.get('Unidade') or row.get('"Unidade"', 'UN')
                price_str = row.get('Preço') or row.get('"Preço"', '0,00')
                price = clean_decimal(price_str)
                status = row.get('Situação') or row.get('"Situação"', '')
                stock = clean_decimal(row.get('Estoque', '0,00'))
                weight = clean_decimal(row.get('Peso líquido (Kg)', '0,00'))
                image_url = row.get('URL Imagens Externas', '').split('|')[0] if row.get('URL Imagens Externas') else ''
                category = row.get('Categoria do produto', '')
                description_comp = row.get('Descrição Complementar', '')
                description_short = row.get('Descrição Curta', '')
                
                active = 'true' if status == 'Ativo' else 'false'
                
                # Default description priority
                description = description_comp or description_short or name
                
                bling_id_val = f"'{bling_id}'" if bling_id and bling_id.strip() else "NULL"
                
                # If SKU is empty, use Bling ID as fallback to ensure uniqueness
                if not sku or not sku.strip():
                    if bling_id:
                        sku = f"B{bling_id}"
                    else:
                        sku = f"N-{normalize(name)[:20]}"
                
                # Check for existing record
                p_id = existing_skus.get(normalize(sku)) or existing_names.get(normalize(name))
                
                if p_id:
                    # UPDATE
                    sql = f"""UPDATE products SET 
                        bling_id = {bling_id_val},
                        sku = '{escape_sql(sku)}',
                        name = '{escape_sql(name)}',
                        unit = '{escape_sql(unit)}',
                        price = {price},
                        stock_qty = {stock},
                        weight_kg = {weight},
                        active = {active},
                        category = '{escape_sql(category)}',
                        description = '{escape_sql(description)}',
                        updated_at = NOW()
                        WHERE id = {p_id};"""
                    updates.append(sql)
                else:
                    # INSERT
                    sql = f"""INSERT INTO products (bling_id, sku, name, unit, price, stock_qty, weight_kg, active, category, description, images, image_url)
                        VALUES ({bling_id_val}, '{escape_sql(sku)}', '{escape_sql(name)}', '{escape_sql(unit)}', {price}, {stock}, {weight}, {active}, '{escape_sql(category)}', '{escape_sql(description)}', '[]', '{escape_sql(image_url)}');"""
                    updates.append(sql)
                    
        with open(OUTPUT_SQL, 'w') as f:
            for sql in updates:
                f.write(sql + '\n')
                
        print(f"Generated {len(updates)} SQL statements in {OUTPUT_SQL}")
        
    except Exception as e:
        print(f"Error during sync: {e}")

if __name__ == "__main__":
    sync()
