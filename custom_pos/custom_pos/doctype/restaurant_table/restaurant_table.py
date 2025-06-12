import frappe
from frappe.model.document import Document

class RestaurantTable(Document):
    def validate(self):
        if self.capacity < 1:
            frappe.throw("Table capacity must be at least 1")
    
    def on_update(self):
        if self.status == "Available" and self.current_order:
            self.current_order = None
