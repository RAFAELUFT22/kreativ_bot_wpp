import frappe
from frappe.utils.password import update_password

def generate_admin_keys():
    user = frappe.get_doc("User", "Administrator")
    
    # generate new keys via user method if it exists, otherwise manually
    if hasattr(user, 'generate_keys'):
        keys = user.generate_keys()
        api_secret = keys.get('api_secret')
        api_key = user.api_key
        frappe.db.commit()
    else:
        api_secret = frappe.generate_hash(length=15)
        api_key = frappe.generate_hash(length=15)
        user.api_key = api_key
        user.api_secret = api_secret
        user.flags.ignore_permissions = True
        user.save()
        frappe.db.commit()

    print(f"FRAPPE_API_KEY={api_key}")
    print(f"FRAPPE_API_SECRET={api_secret}")

