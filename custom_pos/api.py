import frappe
from frappe import _

@frappe.whitelist(allow_guest=True)
def get_items():
    """Get all active items for POS"""
    items = frappe.db.sql("""
        SELECT 
            item.name as item_code,
            item.item_name,
            item.item_group,
            item.standard_rate,
            item.description,
            item.image
        FROM `tabItem` item
        WHERE item.disabled = 0
        AND item.is_sales_item = 1
        ORDER BY item.item_name
    """, as_dict=True)
    
    return items

@frappe.whitelist()
def create_pos_order(order_data):
    """Create a new POS order"""
    try:
        # Parse order data
        import json
        if isinstance(order_data, str):
            order_data = json.loads(order_data)
        
        # Create Sales Invoice
        invoice = frappe.new_doc("Sales Invoice")
        invoice.customer = order_data.get("customer", "Guest")
        invoice.is_pos = 1
        invoice.update_stock = 1
        
        # Add items
        for item in order_data.get("items", []):
            invoice.append("items", {
                "item_code": item.get("item_code"),
                "item_name": item.get("item_name"),
                "qty": item.get("quantity", 1),
                "rate": item.get("price", 0),
                "warehouse": frappe.db.get_single_value("Stock Settings", "default_warehouse")
            })
        
        # Save and submit
        invoice.insert()
        invoice.submit()
        
        return {
            "success": True,
            "invoice_name": invoice.name,
            "message": _("Order created successfully")
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "POS Order Creation Error")
        return {
            "success": False,
            "message": str(e)
        }

@frappe.whitelist()
def get_pos_profile():
    """Get default POS Profile"""
    profiles = frappe.get_all("POS Profile", 
        filters={"disabled": 0}, 
        fields=["name", "warehouse", "company"]
    )
    
    if profiles:
        return profiles[0]
    return None

@frappe.whitelist()
def get_customers():
    """Get customers for POS"""
    customers = frappe.get_all("Customer",
        filters={"disabled": 0},
        fields=["name", "customer_name", "mobile_no", "email_id"],
        limit=100
    )
    
    return customers

@frappe.whitelist()
def create_customer(customer_name, mobile_no=None, email_id=None):
    """Quick customer creation for POS"""
    try:
        customer = frappe.new_doc("Customer")
        customer.customer_name = customer_name
        customer.customer_type = "Individual"
        
        if mobile_no:
            customer.mobile_no = mobile_no
        if email_id:
            customer.email_id = email_id
            
        customer.insert()
        
        return {
            "success": True,
            "customer": customer.name,
            "message": _("Customer created successfully")
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": str(e)
        }
