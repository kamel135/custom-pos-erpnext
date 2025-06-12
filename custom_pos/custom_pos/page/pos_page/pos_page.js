frappe.pages['pos-page'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'نقطة البيع - POS',
        single_column: true
    });

    // Initialize POS
    new POSInterface(page);
}

class POSInterface {
    constructor(page) {
        this.page = page;
        this.cart = [];
        this.current_customer = 'Walk In Customer';
        
        this.init();
    }

    init() {
        this.setup_header();
        this.setup_layout();
        this.load_items();
        this.bind_events();
    }

    setup_header() {
        this.page.set_primary_action('New Order', () => {
            this.new_order();
        }, 'octicon octicon-plus');
    }

    setup_layout() {
        this.page.main.html(`
            <style>
                .pos-container {
                    display: flex;
                    height: calc(100vh - 100px);
                    gap: 20px;
                }
                .pos-left {
                    flex: 2;
                    background: #f5f5f5;
                    padding: 20px;
                    overflow-y: auto;
                }
                .pos-right {
                    flex: 1;
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .items-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 15px;
                }
                .item-card {
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .item-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }
                .item-name {
                    font-weight: bold;
                    margin: 10px 0;
                }
                .item-price {
                    color: #2196F3;
                    font-size: 1.2em;
                }
                .cart-header {
                    font-size: 1.2em;
                    font-weight: bold;
                    margin-bottom: 20px;
                    padding-bottom: 10px;
                    border-bottom: 2px solid #eee;
                }
                .cart-items {
                    max-height: 400px;
                    overflow-y: auto;
                    margin-bottom: 20px;
                }
                .cart-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px;
                    border-bottom: 1px solid #eee;
                }
                .cart-total {
                    font-size: 1.5em;
                    font-weight: bold;
                    text-align: right;
                    padding: 20px 0;
                    border-top: 2px solid #333;
                }
                .btn-checkout {
                    width: 100%;
                    padding: 15px;
                    font-size: 1.2em;
                }
                .empty-cart {
                    text-align: center;
                    color: #999;
                    padding: 40px;
                }
                .category-filters {
                    display: flex;
                    gap: 10px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .category-btn {
                    padding: 8px 16px;
                    border: 1px solid #ddd;
                    background: white;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.3s;
                }
                .category-btn.active {
                    background: #2196F3;
                    color: white;
                    border-color: #2196F3;
                }
            </style>
            
            <div class="pos-container">
                <div class="pos-left">
                    <h3>المنتجات</h3>
                    <div class="category-filters"></div>
                    <div class="items-grid"></div>
                </div>
                <div class="pos-right">
                    <div class="cart-header">السلة</div>
                    <div class="cart-items">
                        <div class="empty-cart">السلة فارغة</div>
                    </div>
                    <div class="cart-total">
                        الإجمالي: <span class="total-amount">0.00</span>
                    </div>
                    <button class="btn btn-primary btn-checkout">إتمام الطلب</button>
                </div>
            </div>
        `);
    }

    load_items() {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Item',
                filters: {
                    'is_sales_item': 1,
                    'disabled': 0
                },
                fields: ['name', 'item_name', 'standard_rate', 'item_group'],
                limit_page_length: 100
            },
            callback: (r) => {
                this.items = r.message;
                this.render_categories();
                this.render_items(r.message);
            }
        });
    }

    render_categories() {
        const categories = [...new Set(this.items.map(item => item.item_group))];
        let html = '<button class="category-btn active" data-category="all">الكل</button>';
        
        categories.forEach(cat => {
            if (cat) {
                html += `<button class="category-btn" data-category="${cat}">${cat}</button>`;
            }
        });
        
        this.page.main.find('.category-filters').html(html);
    }

    render_items(items) {
        let html = '';
        
        items.forEach(item => {
            html += `
                <div class="item-card" data-item='${JSON.stringify(item)}'>
                    <div class="item-name">${item.item_name}</div>
                    <div class="item-price">${item.standard_rate || 0} جنيه</div>
                </div>
            `;
        });
        
        this.page.main.find('.items-grid').html(html);
    }

    bind_events() {
        // Category filter
        this.page.main.on('click', '.category-btn', (e) => {
            $('.category-btn').removeClass('active');
            $(e.target).addClass('active');
            
            const category = $(e.target).data('category');
            if (category === 'all') {
                this.render_items(this.items);
            } else {
                const filtered = this.items.filter(item => item.item_group === category);
                this.render_items(filtered);
            }
        });

        // Add to cart
        this.page.main.on('click', '.item-card', (e) => {
            const item = $(e.currentTarget).data('item');
            this.add_to_cart(item);
        });

        // Checkout
        this.page.main.on('click', '.btn-checkout', () => {
            this.checkout();
        });
    }

    add_to_cart(item) {
        const existing = this.cart.find(i => i.item_code === item.name);
        
        if (existing) {
            existing.qty += 1;
        } else {
            this.cart.push({
                item_code: item.name,
                item_name: item.item_name,
                rate: item.standard_rate || 0,
                qty: 1
            });
        }
        
        this.update_cart_display();
    }

    update_cart_display() {
        if (this.cart.length === 0) {
            this.page.main.find('.cart-items').html('<div class="empty-cart">السلة فارغة</div>');
            this.page.main.find('.total-amount').text('0.00');
            return;
        }

        let html = '';
        let total = 0;
        
        this.cart.forEach((item, idx) => {
            const amount = item.rate * item.qty;
            total += amount;
            
            html += `
                <div class="cart-item">
                                html += `
                <div class="cart-item">
                    <div>
                        <strong>${item.item_name}</strong>
                        <br>
                        <small>${item.qty} × ${item.rate} جنيه</small>
                    </div>
                    <div>
                        <strong>${amount.toFixed(2)} جنيه</strong>
                        <br>
                        <button class="btn btn-xs btn-danger remove-item" data-idx="${idx}">حذف</button>
                    </div>
                </div>
            `;
        });
        
        this.page.main.find('.cart-items').html(html);
        this.page.main.find('.total-amount').text(total.toFixed(2));
        
        // Bind remove item event
        this.page.main.find('.remove-item').on('click', (e) => {
            const idx = $(e.target).data('idx');
            this.cart.splice(idx, 1);
            this.update_cart_display();
        });
    }

    checkout() {
        if (this.cart.length === 0) {
            frappe.msgprint('السلة فارغة!');
            return;
        }

        frappe.call({
            method: 'custom_pos.api.create_pos_invoice',
            args: {
                customer: this.current_customer,
                items: this.cart
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.msgprint({
                        title: 'تم إنشاء الفاتورة',
                        message: `رقم الفاتورة: ${r.message.invoice_name}`,
                        indicator: 'green'
                    });
                    
                    // Clear cart
                    this.cart = [];
                    this.update_cart_display();
                    
                    // Print option
                    frappe.confirm(
                        'هل تريد طباعة الفاتورة؟',
                        () => {
                            this.print_invoice(r.message.invoice_name);
                        }
                    );
                }
            }
        });
    }

    print_invoice(invoice_name) {
        window.open(
            frappe.urllib.get_full_url(`/printview?doctype=Sales%20Invoice&name=${invoice_name}&format=Standard&no_letterhead=0&letterhead=Standard&settings=%7B%7D&_lang=en`),
            '_blank'
        );
    }

    new_order() {
        if (this.cart.length > 0) {
            frappe.confirm(
                'السلة تحتوي على منتجات. هل تريد إلغاء الطلب الحالي؟',
                () => {
                    this.cart = [];
                    this.update_cart_display();
                }
            );
        }
    }
}
