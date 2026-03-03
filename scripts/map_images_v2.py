import csv
import re
import os

# Paths
DB_CSV = '/tmp/db_products_all.csv' # I'll regenerate this with ALL active products
MINIO_TXT = '/tmp/minio_files.txt'
OUTPUT_SQL = '/tmp/update_images_v2.sql'

def normalize(text):
    if text is None:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(text).lower())

def parse_minio_structure(minio_txt):
    """Parses MinIO listing into {category_name: [filenames], ...}"""
    categories = {}
    current_cat = None
    try:
        with open(minio_txt, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith('/data/norte-piscinas/products/'):
                    # e.g. /data/norte-piscinas/products/Weekend:
                    current_cat = line.split('/products/')[1].rstrip(':')
                    if current_cat not in categories:
                        categories[current_cat] = []
                elif line and current_cat and (line.endswith('.png') or line.endswith('.jpg')):
                    if '.meta' not in line and 'part.' not in line:
                        categories[current_cat].append(line)
        return categories
    except Exception as e:
        print(f"Error parsing MinIO: {e}")
        return {}

def find_best_category(product_name, categories):
    """Matches product name to a MinIO category folder."""
    norm_p = normalize(product_name)
    # 1. Exact match
    for cat in categories:
        if normalize(cat) == norm_p:
            return cat
    # 2. Product name contains category name
    for cat in categories:
        norm_cat = normalize(cat)
        if norm_cat and norm_cat in norm_p:
            return cat
    # 3. Category name contains product name (short names)
    for cat in categories:
        norm_cat = normalize(cat)
        if norm_p and norm_p in norm_cat:
            return cat
    return None

def find_best_file(product_name, files):
    """Matches product name to a specific file in a category."""
    norm_p = normalize(product_name)
    # 1. Exact match in filename
    for f in files:
        if norm_p in normalize(f):
            return f
    # 2. Sequential/Default files
    for fb in ['1.png', '1.jpg', '2.png', '2.jpg']:
        if fb in files:
            return fb
    # 3. Just take the first one if anything exists
    if files:
        return files[0]
    return None

def main():
    minio_cats = parse_minio_structure(MINIO_TXT)
    updates = []
    
    try:
        with open(DB_CSV, 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                p_id = row['id']
                p_name = row['name']
                
                cat = find_best_category(p_name, minio_cats)
                if cat:
                    best_f = find_best_file(p_name, minio_cats[cat])
                    if best_f:
                        new_url = f"https://s3.extensionista.site/norte-piscinas/products/{cat}/{best_f}".replace(' ', '%20')
                        sql = f"UPDATE products SET image_url = '{new_url}', images = '[\"{new_url}\"]' WHERE id = {p_id};"
                        updates.append(sql)
                else:
                    print(f"No category found for: {p_name}")
                    
        with open(OUTPUT_SQL, 'w') as f:
            for sql in updates:
                f.write(sql + '\n')
        print(f"Generated {len(updates)} updates in {OUTPUT_SQL}")
        
    except Exception as e:
        print(f"Error in main: {e}")

if __name__ == "__main__":
    main()
