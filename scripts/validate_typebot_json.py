import sys
import json

def validate_typebot(data):
    errors = []
    
    # Root level checks
    for key in ["groups", "events", "edges", "variables"]:
        if key not in data:
            errors.append(f"Missing '{key}' in root")
            
    if not isinstance(data.get("groups", []), list):
        errors.append("'groups' must be a list")
        return errors

    groups = data.get("groups", [])
    if not groups:
        errors.append("No groups found")
    else:
        # Check start block in the first group
        start_group = groups[0]
        has_start_block = any(b.get("type") == "start" for b in start_group.get("blocks", []))
        if not has_start_block:
            errors.append("First group (groups[0]) must contain a block with type='start'")

    # Groups checks
    for i, g in enumerate(groups):
        if "graphCoordinates" not in g:
            errors.append(f"Group '{g.get('title', i)}' missing 'graphCoordinates'")
            
        blocks = g.get("blocks", [])
        for b in blocks:
            b_type = b.get("type")
            
            # RichText check for text blocks
            if b_type == "text":
                content = b.get("content", {})
                rt = content.get("richText")
                if not isinstance(rt, list):
                    errors.append(f"Block '{b.get('id')}' richText must be a list")

            # Type mapping checks
            if b_type == "Choice":
                errors.append(f"Block '{b.get('id')}' uses legacy 'Choice' instead of 'choice input'")
            if b_type == "webhook":
                errors.append(f"Block '{b.get('id')}' uses lowercase 'webhook' (client-side) instead of 'Webhook' (server-side)")
                
            # Check edge items
            if b_type in ["Condition", "choice input"]:
                items = b.get("items", [])
                for item in items:
                    if not item.get("id"):
                        errors.append(f"Item in block '{b.get('id')}' missing id")

    # Edge checks
    edges = data.get("edges", [])
    for edge in edges:
        to = edge.get("to", {})
        if "groupId" not in to:
            errors.append(f"Edge '{edge.get('id')}' missing 'groupId' in 'to'. Edges must point to groups.")
        
        frm = edge.get("from", {})
        if "eventId" not in frm and "blockId" not in frm:
            errors.append(f"Edge '{edge.get('id')}' missing source (blockId or eventId) in 'from'")

    return errors

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_typebot_json.py <file.json>")
        sys.exit(1)
        
    try:
        with open(sys.argv[1], "r", encoding="utf-8") as f:
            data = json.load(f)
            
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
