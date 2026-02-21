import sys
import json

def validate_typebot(data):
    errors = []
    
    # Root level checks
    for key in ["groups", "events", "edges"]:
        if key not in data:
            errors.append(f"Missing '{key}' in root")
            
    if not isinstance(data.get("groups", []), list):
        errors.append("'groups' must be a list")
        return errors

    groups = data.get("groups", [])
    if not groups:
        errors.append("No groups found")
    else:
        # Check start group
        start_group = groups[0]
        has_start_block = any(b.get("type") == "start" for b in start_group.get("blocks", []))
        if not has_start_block:
            errors.append("First group must contain a block with type='start'")

    # Blocks checks
    for i, g in enumerate(groups):
        blocks = g.get("blocks", [])
        for b in blocks:
            b_type = b.get("type")
            if b_type == "condition":
                errors.append(f"Block '{b.get('id')}' in group '{g.get('title')}' uses 'condition' instead of 'Condition'")
            if b_type == "Webhook":
                errors.append(f"Block '{b.get('id')}' in group '{g.get('title')}' uses 'Webhook' instead of 'webhook'")
                
            # Check edge items
            if b_type in ["Condition", "choice input"]:
                items = b.get("items", [])
                for item in items:
                    if not item.get("id"):
                        errors.append(f"Item in block '{b.get('id')}' missing id")

    # Edge checks
    edges = data.get("edges", [])
    events = {e["id"]: e for e in data.get("events", [])}
    
    for edge in edges:
        frm = edge.get("from", {})
        if "eventId" in frm:
            if frm["eventId"] not in events:
                errors.append(f"Edge '{edge.get('id')}' references missing eventId '{frm['eventId']}'")
        elif "blockId" not in frm:
            errors.append(f"Edge '{edge.get('id')}' missing blockId or eventId in 'from'")

    return errors

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_typebot_json.py <file.json>")
        sys.exit(1)
        
    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
            
        # Handle export wrapper if present
        if "typebot" in data:
            data = data["typebot"]
            
        errors = validate_typebot(data)
        if errors:
            print(f"Validation failed for {sys.argv[1]}:")
            for e in errors:
                print(f" - {e}")
            sys.exit(1)
        else:
            print(f"Validation passed for {sys.argv[1]}")
            sys.exit(0)
    except Exception as e:
        print(f"Error reading {sys.argv[1]}: {e}")
        sys.exit(1)
