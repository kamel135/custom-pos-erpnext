// Enhanced POS System
class RestaurantPOS {
    constructor() {
        this.cart = [];
        this.customers = [];
        this.items = [];
        this.currentCategory = 'all';
        this.orderType = 'dine-in';
        this.selectedCustomer = null;
        this.discountAmount = 0;
        this.taxRate = 0.14;
        
        this.init();
    }
    
    async init() {
        await this.loadItems();
        await this.loadCustomers();
        this.setupEventListeners();
        this.displayItems();
        this.updateCart();
    }
    
    async loadItems() {
        try {
            const response = await frappe.call({
                method: 'custom_pos.api.get_items',
                callback: (r) => {
                    if (r.message) {
                        this.items = r.message.map((item, index) => ({
                            id: index + 1,
                            item_code: item.item_code,
                            name: item.item_name,
                            price: item.standard_rate || 0,
                            category: item.item_group || 'uncategorized',
                            image: item.image,
                            description: item.description
                        }));
                    }
                }
            });
        } catch (error) {
            console.error('Error loading items:', error);
            frappe.msgprint('خطأ في تحميل المنتجات');
        }
    }
    
    async loadCustomers() {
        try {
            const response = await frappe.call({
                method: 'custom_pos.api.get_customers',
                callback: (r) => {
                    if (r.message) {
                        this.customers = r.message;
                    }
                }
            });
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    }
    
    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchItems(e.target.value);
            });
        }
        
        // Customer search
        const customerInput = document.getElementById('customer-input');
        if (customerInput) {
            customerInput.addEventListener('input', (e) => {
                this.searchCustomers(e.target.value);
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // F2 - Clear Cart
            if (e.key === 'F2') {
                e.preventDefault();
                this.clearCart();
            }
            // F4 - Payment
            if (e.key === 'F4') {
                e.preventDefault();
                this.processPayment();
            }
            // F6 - Discount
            if (e.key === 'F6') {
                e.preventDefault();
                this.applyDiscount();
            }
        });
    }
    
    displayItems(category = 'all') {
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        const filteredItems = category === 'all' 
            ? this.items 
            : this.items.filter(item => item.category === category);
        
        grid.innerHTML = filteredItems.map(item => `
            <div class="product-card" data-item-id="${item.id}">
                <div class="product-icon">
                    ${item.image ? `<img src="${item.image}" alt="${item.name}">` : this.getItemIcon(item.category)}
                </div>
                <div class="product-name">${item.name}</div>
                <div class="product-price">${this.formatCurrency(item.price)}</div>
            </div>
        `).join('');
        
        // Add click events
        grid.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = parseInt(card.dataset.itemId);
                this.addToCart(itemId);
            });
        });
    }
    
    getItemIcon(category) {
        const icons = {
            'meals': '🍔',
            'drinks': '🥤',
            'sides': '🍟',
            'desserts': '🍰',
            'default': '📦'
        };
        return `<span class="category-icon">${icons[category] || icons.default}</span>`;
    }
    
    searchItems(searchTerm) {
        const filtered = this.items.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.item_code.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const grid = document.getElementById('products-grid');
        if (!grid) return;
        
        grid.innerHTML = filtered.map(item => `
            <div class="product-card" data-item-id="${item.id}">
                <div class="product-icon">${this.getItemIcon(item.category)}</div>
                <div class="product-name">${item.name}</div>
                <div class="product-price">${this.formatCurrency(item.price)}</div>
            </div>
        `).join('');
        
        // Re-add click events
        grid.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const itemId = parseInt(card.dataset.itemId);
                this.addToCart(itemId);
            });
        });
    }
    
    addToCart(itemId) {
        const item = this.items.find(i => i.id === itemId);
        if (!item) return;
        
        const existingItem = this.cart.find(cartItem => cartItem.id === itemId);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.cart.push({
                ...item,
                quantity: 1
            });
        }
        
        this.updateCart();
        this.showNotification(`تم إضافة ${item.name} إلى السلة`);
    }
    
    updateCart() {
        const cartItemsDiv = document.getElementById('cart-items');
        if (!cartItemsDiv) return;
        
        if (this.cart.length === 0) {
            cartItemsDiv.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-basket"></i>
                    <p>السلة فارغة</p>
                    <small>اختر منتجات لإضافتها</small>
                </div>
            `;
        } else {
            cartItemsDiv.innerHTML = this.cart.map((item, index) => `
                <div class="cart-item" data-index="${index}">
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">${this.formatCurrency(item.price)} × ${item.quantity}</div>
                    </div>
                    <div class="quantity-controls">
                        <button class="qty-btn" onclick="pos.decreaseQuantity(${item.id})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="qty-btn" onclick="pos.increaseQuantity(${item.id})">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="qty-btn remove" onclick="pos.removeFromCart(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
        
        this.updateTotals();
    }
    
    updateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + tax - this.discountAmount;
        
        document.getElementById('subtotal').textContent = this.formatCurrency(subtotal);
        document.getElementById('tax').textContent = this.formatCurrency(tax);
        document.getElementById('discount').textContent = this.formatCurrency(this.discountAmount);
        document.getElementById('total').textContent = this.formatCurrency(total);
    }
    
    increaseQuantity(itemId) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            item.quantity += 1;
            this.updateCart();
        }
    }
    
    decreaseQuantity(itemId) {
        const item = this.cart.find(item => item.id === itemId);
        if (item) {
            if (item.quantity > 1) {
                item.quantity -= 1;
            } else {
                this.removeFromCart(itemId);
            }
            this.updateCart();
        }
    }
    
    removeFromCart(itemId) {
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.updateCart();
    }
    
    clearCart() {
        if (this.cart.length === 0) return;
        
        frappe.confirm(
            'هل أنت متأكد من مسح جميع العناصر من السلة؟',
            () => {
                this.cart = [];
                this.discountAmount = 0;
                this.updateCart();
                this.showNotification('تم مسح السلة');
            }
        );
    }
    
    applyDiscount() {
        frappe.prompt([
            {
                label: 'نوع الخصم',
                fieldname: 'discount_type',
                fieldtype: 'Select',
                options: ['نسبة مئوية', 'مبلغ ثابت'],
                default: 'نسبة مئوية',
                reqd: 1
            },
            {
                label: 'قيمة الخصم',
                fieldname: 'discount_value',
                fieldtype: 'Float',
                reqd: 1
            }
        ], (values) => {
            const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            if (values.discount_type === 'نسبة مئوية') {
                this.discountAmount = subtotal * (values.discount_value / 100);
            } else {
                this.discountAmount = values.discount_value;
            }
            
            // Ensure discount doesn't exceed subtotal
            if (this.discountAmount > subtotal) {
                this.discountAmount = subtotal;
            }
            
            this.updateTotals();
            this.showNotification(`تم تطبيق خصم: ${this.formatCurrency(this.discountAmount)}`);
        }, 'تطبيق خصم', 'تطبيق');
    }
    
    async processPayment() {
        if (this.cart.length === 0) {
            frappe.msgprint('السلة فارغة!');
            return;
        }
        
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * this.taxRate;
        const total = subtotal + tax - this.discountAmount;
        
        frappe.prompt([
            {
                label: 'طريقة الدفع',
                fieldname: 'payment_method',
                fieldtype: 'Select',
                options: ['نقدي', 'بطاقة ائتمان', 'محفظة إلكترونية'],
                default: 'نقدي',
                reqd: 1
            },
            {
                label: 'المبلغ المستلم',
                fieldname: 'amount_received',
                fieldtype: 'Currency',
                default: total,
                reqd: 1
            }
        ], async (values) => {
            if (values.amount_received < total) {
                frappe.msgprint('المبلغ المستلم أقل من الإجمالي!');
                return;
            }
            
            const change = values.amount_received - total;
            
            // Prepare order data
            const orderData = {
                customer: this.selectedCustomer || 'Guest',
                order_type: this.orderType,
                items: this.cart.map(item => ({
                    item_code: item.item_code,
                    item_name: item.name,
                    quantity: item.quantity,
                    price: item.price
                })),
                subtotal: subtotal,
                tax: tax,
                discount: this.discountAmount,
                total: total,
                payment_method: values.payment_method,
                amount_received: values.amount_received,
                change: change
            };
            
            // Create order
            try {
                const response = await frappe.call({
                    method: 'custom_pos.api.create_pos_order',
                    args: {
                        order_data: JSON.stringify(orderData)
                    }
                });
                
                if (response.message && response.message.success) {
                    frappe.msgprint({
                        title: 'تم إنشاء الطلب بنجاح',
                        message: `رقم الفاتورة: ${response.message.invoice_name}<br>الباقي: ${this.formatCurrency(change)}`,
                        indicator: 'green'
                    });
                    
                    // Clear cart
                    this.cart = [];
                    this.discountAmount = 0;
                    this.selectedCustomer = null;
                    this.updateCart();
                    
                    // Print receipt if needed
                    if (frappe.confirm('هل تريد طباعة الإيصال؟')) {
                        this.printReceipt(response.message.invoice_name);
                    }
                } else {
                    frappe.msgprint({
                        title: 'خطأ',
                        message: response.message.message || 'حدث خطأ أثناء إنشاء الطلب',
                        indicator: 'red'
                    });
                }
            } catch (error) {
                console.error('Error creating order:', error);
                frappe.msgprint('حدث خطأ أثناء معالجة الطلب');
            }
        }, 'معالجة الدفع', 'دفع');
    }
    
    printReceipt(invoiceName) {
        // Open print dialog for the invoice
        frappe.set_route('print', 'Sales Invoice', invoiceName);
    }
    
    formatCurrency(amount) {
        return `${amount.toFixed(2)} جنيه`;
    }
    
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'pos-notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    setOrderType(type) {
        this.orderType = type;
        document.querySelectorAll('.order-type-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }
    
    filterCategory(category) {
        this.currentCategory = category;
        this.displayItems(category);
        
        // Update active button
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
    }
}

// Initialize POS when document is ready
let pos;
document.addEventListener('DOMContentLoaded', function() {
    if (typeof frappe !== 'undefined') {
        frappe.ready(() => {
            pos = new RestaurantPOS();
        });
    } else {
        //        // Fallback for when Frappe is not available (standalone mode)
        pos = new RestaurantPOS();
    }
});

// Global functions for onclick events
window.pos = pos;
window.filterCategory = (category) => pos.filterCategory(category);
window.setOrderType = (type) => pos.setOrderType(type);
window.clearCart = () => pos.clearCart();
window.applyDiscount = () => pos.applyDiscount();
window.processPayment = () => pos.processPayment();
