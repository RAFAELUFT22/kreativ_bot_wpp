import csv
import re
import os

# Paths (adjust based on where you are running the script)
DB_CSV = '/tmp/db_products.csv'
MINIO_TXT = '/tmp/minio_files.txt'

def parse_minio_files(minio_txt):
    """Parses the MinIO recursive listing into a dictionary of category -> list of filenames."""
    categories = {}
    current_category = None
    
    try:
        with open(minio_txt, 'r') as f:
            lines = f.readlines()
            
        for line in lines:
            line = line.strip()
            if line.startswith('/data/norte-piscinas/products/'):
                # Extract category from path
                current_category = line.split('/products/')[1].rstrip(':')
                if current_category not in categories:
                    categories[current_category] = []
            elif line and current_category and not line.endswith('.meta') and 'part.1' not in line:
                if line.endswith('.png') or line.endswith('.jpg'):
                    categories[current_category].append(line)
        return categories
    except Exception as e:
        print(f"Error parsing MinIO files: {e}")
        return {}

def normalize(text):
    """Normalize text for comparison (lowercase, alphanumeric only)."""
    if text is None:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(text).lower())

def find_best_match(product_name, category_files):
    """Finds the best matching file in the category for a given product name."""
    norm_name = normalize(product_name)
    
    # Try exact match first (after normalization)
    for filename in category_files:
        if norm_name in normalize(filename):
            return filename
            
    # Try partial matches if no exact match found
    # (Simplified for now)
    return None

def generate_updates(db_csv, minio_categories):
    """Generates SQL update statements."""
    updates = []
    
    try:
        with open(db_csv, 'r') as f:
            reader = csv.DictReader(f, fieldnames=['id', 'sku', 'name', 'image_url'])
            # Skip header if it exists
            rows = list(reader)
            if rows and rows[0]['id'] == 'id':
                rows = rows[1:]
                
            for row in rows:
                p_id = row['id']
                p_name = row['name']
                p_img = row['image_url']
                
                if p_img:
                    match = re.search(r'/products/([^/]+)/', p_img)
                    if match:
                        category = match.group(1).replace('%20', ' ')
                        print(f"Checking category: {category} for product: {p_name}")
                        if category in minio_categories:
                            best_file = find_best_match(p_name, minio_categories[category])
                            if best_file:
                                new_url = f"https://s3.extensionista.site/norte-piscinas/products/{category}/{best_file}".replace(' ', '%20')
                                updates.append(f"UPDATE products SET image_url = '{new_url}', images = '[\"{new_url}\"]' WHERE id = {p_id};")
                            else:
                                # Try to find common file names like '1.png' if descriptive name fails
                                for fb in ['1.png', '1.jpg', '2.png', '2.jpg']:
                                    if fb in minio_categories[category]:
                                        new_url = f"https://s3.extensionista.site/norte-piscinas/products/{category}/{fb}".replace(' ', '%20')
                                        updates.append(f"UPDATE products SET image_url = '{new_url}', images = '[\"{new_url}\"]' WHERE id = {p_id};")
                                        break
        return updates
    except Exception as e:
        print(f"Error generating updates: {e}")
        return []

if __name__ == "__main__":
    minio_files = parse_minio_files(MINIO_TXT)
    sql_updates = generate_updates(DB_CSV, minio_files)
    
    with open('/tmp/update_images.sql', 'w') as f:
        for sql in sql_updates:
            f.write(sql + '\n')
    
    print(f"Generated {len(sql_updates)} updates in /tmp/update_images.sql")
