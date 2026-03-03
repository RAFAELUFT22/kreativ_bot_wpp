import csv
import json

def update_json():
    json_path = '/NORTE_PISCINAS/produtos_landing.json'
    
    # Read current JSON
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            products = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    # Fetch DB mappings
    db_images = {}
    try:
        with open('/tmp/db_products_all.csv', 'r') as f:
            reader = csv.DictReader(f)
            for row in reader:
                bling_id = row.get('id') or ''
                sku = row.get('sku') or ''
                name = row.get('name') or ''
                image_url = row.get('image_url') or ''
                images_json = row.get('images') or '[]'
                
                img_list = []
                if images_json and images_json != '[]':
                    import json as _json
                    try:
                        img_list = _json.loads(images_json.replace('""', '"'))
                        if isinstance(img_list, str):
                            img_list = _json.loads(img_list)
                    except:
                        pass
                if not img_list and image_url:
                    img_list = [image_url]
                    
                db_images[sku] = img_list
                db_images[name.strip().lower()] = img_list
                
    except Exception as e:
        print(f"Error reading CSV: {e}")
        return

    # Update JSON
    updated_count = 0
    for p in products:
        b_id = str(p.get('id', ''))
        sku = str(p.get('sku', ''))
        name = str(p.get('name', '')).strip().lower()
        
        new_images = None
        if b_id in db_images:
            new_images = db_images[b_id]
        elif sku in db_images:
            new_images = db_images[sku]
        elif name in db_images:
            new_images = db_images[name]
            
        if new_images is not None:
            p['images'] = new_images
            updated_count += 1
            
    # Write back
    try:
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(products, f, ensure_ascii=False, indent=2)
        print(f"Updated {updated_count} products in {json_path}")
    except Exception as e:
        print(f"Error writing JSON: {e}")

if __name__ == "__main__":
    update_json()
