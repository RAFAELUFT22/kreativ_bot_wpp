import csv
import re

# Paths
CSV_PATH = '/NORTE_PISCINAS/produtos_2026-02-24-23-59-11.csv'
DB_NAMES_CSV = '/tmp/db_names.csv'

def normalize(text):
    if text is None:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(text).lower())

def compare():
    db_names = set()
    try:
        with open(DB_NAMES_CSV, 'r') as f:
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                db_names.add(normalize(row['name']))
    except Exception as e:
        print(f"Error loading DB names: {e}")
        return

    missing_in_db = []
    try:
        with open(CSV_PATH, 'r', encoding='utf-8', errors='replace') as f:
            # We know DictReader stops at 100, but let's see which ones they are
            reader = csv.DictReader(f, delimiter=';')
            for row in reader:
                name = (row.get('Descrição') or row.get('"Descrição"', '')).strip()
                if normalize(name) not in db_names:
                    missing_in_db.append(name)
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return

    print(f"Found {len(missing_in_db)} products in CSV that are MISSING in DB:")
    for name in missing_in_db:
        print(f"- {name}")

if __name__ == "__main__":
    compare()
