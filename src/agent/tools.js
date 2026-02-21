import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

// Tool definitions
const toolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'get_business_info',
            description: 'Get basic business information like name, type, hours, location, and contact details',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_menu',
            description: 'Get the complete menu or service list with prices',
            parameters: {
                type: 'object',
                properties: {
                    category: { type: 'string', description: 'Optional category filter (e.g., "drinks", "mains")' }
                },
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'check_availability',
            description: 'Check if tables or appointments are available for a specific date and time',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                    time: { type: 'string', description: 'Time in HH:MM format (24-hour)' },
                    guests: { type: 'number', description: 'Number of guests/people' }
                },
                required: ['date', 'time', 'guests']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'create_booking',
            description: 'Create a new table reservation or appointment booking',
            parameters: {
                type: 'object',
                properties: {
                    date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
                    time: { type: 'string', description: 'Time in HH:MM format' },
                    guests: { type: 'number', description: 'Number of guests' },
                    name: { type: 'string', description: 'Customer name' },
                    phone: { type: 'string', description: 'Customer phone number' },
                    notes: { type: 'string', description: 'Any special requests or notes' }
                },
                required: ['date', 'time', 'guests', 'name', 'phone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'take_order',
            description: 'Record a new order from a customer',
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        description: 'Array of {name, quantity, price} objects',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                quantity: { type: 'number' },
                                price: { type: 'number' }
                            },
                            required: ['name', 'quantity']
                        }
                    },
                    customerName: { type: 'string', description: 'Customer name' },
                    customerPhone: { type: 'string', description: 'Customer phone' },
                    delivery: { type: 'boolean', description: 'Is this for delivery?' },
                    address: { type: 'string', description: 'Delivery address if applicable' }
                },
                required: ['items', 'customerName', 'customerPhone']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_directions',
            description: 'Get directions to the business location with Google Maps link',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'handle_complaint',
            description: 'Record and acknowledge a customer complaint, flagging for owner attention if urgent',
            parameters: {
                type: 'object',
                properties: {
                    customerName: { type: 'string', description: 'Customer name' },
                    customerPhone: { type: 'string', description: 'Customer phone' },
                    issue: { type: 'string', description: 'Description of the issue' },
                    urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How urgent is this?' }
                },
                required: ['customerName', 'issue', 'urgency']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'collect_feedback',
            description: 'Collect customer feedback after a visit or order',
            parameters: {
                type: 'object',
                properties: {
                    customerName: { type: 'string', description: 'Customer name' },
                    rating: { type: 'number', description: 'Rating from 1-5' },
                    comment: { type: 'string', description: 'Optional comment' }
                },
                required: ['rating']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'escalate',
            description: 'Escalate a critical issue to the business owner immediately',
            parameters: {
                type: 'object',
                properties: {
                    reason: { type: 'string', description: 'Reason for escalation' },
                    customerInfo: { type: 'string', description: 'Customer contact info' },
                    details: { type: 'string', description: 'Additional details' }
                },
                required: ['reason']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'search_knowledge',
            description: 'Search the knowledge base for information about policies, FAQs, or business details',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'Search query' }
                },
                required: ['query']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'calculate_price',
            description: 'Calculate the total price for a list of items',
            parameters: {
                type: 'object',
                properties: {
                    items: {
                        type: 'array',
                        description: 'Array of {name, quantity, unitPrice} objects',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                quantity: { type: 'number' },
                                unitPrice: { type: 'number' }
                            },
                            required: ['name', 'quantity', 'unitPrice']
                        }
                    }
                },
                required: ['items']
            }
        }
    }
];

// Tool executor
class ToolExecutor {
    constructor() {
        this.tools = toolDefinitions;
        this.businessConfig = null;
        this.orders = [];
    }

    async loadBusinessConfig() {
        try {
            const configPath = join(projectRoot, 'config/business.json');
            const data = await fs.readFile(configPath, 'utf-8');
            this.businessConfig = JSON.parse(data);
        } catch (err) {
            console.warn('⚠️ No business config found, using defaults');
            this.businessConfig = {
                name: 'Restaurant',
                type: 'restaurant',
                location: { address: '', city: '', googleMapsUrl: '' },
                contact: { phone: '', email: null },
                hours: 'Not configured',
                services: []
            };
        }
    }

    getToolDefinitions() {
        return this.tools;
    }

    async execute(toolName, args) {
        await this.loadBusinessConfig();

        switch (toolName) {
            case 'get_business_info':
                return this.getBusinessInfo();
            case 'get_menu':
                return this.getMenu(args.category);
            case 'check_availability':
                return this.checkAvailability(args.date, args.time, args.guests);
            case 'create_booking':
                return this.createBooking(args);
            case 'take_order':
                return this.takeOrder(args);
            case 'get_directions':
                return this.getDirections();
            case 'handle_complaint':
                return this.handleComplaint(args);
            case 'collect_feedback':
                return this.collectFeedback(args);
            case 'escalate':
                return this.escalate(args);
            case 'search_knowledge':
                return this.searchKnowledge(args.query);
            case 'calculate_price':
                return this.calculatePrice(args.items);
            default:
                throw new Error(`Unknown tool: ${toolName}`);
        }
    }

    // Tool implementations
    async getBusinessInfo() {
        return {
            success: true,
            data: {
                name: this.businessConfig.name,
                type: this.businessConfig.type,
                hours: this.businessConfig.hours,
                location: this.businessConfig.location,
                contact: this.businessConfig.contact,
                description: this.businessConfig.description
            }
        };
    }

    async getMenu(category = null) {
        const services = this.businessConfig.services || [];
        let menu = services.map(s => {
            const parts = s.split(/[-—]/);
            return {
                name: parts[0]?.trim() || s,
                price: parts[1]?.trim() || 'TBD'
            };
        });

        if (category) {
            menu = menu.filter(item =>
                item.name.toLowerCase().includes(category.toLowerCase())
            );
        }

        return { success: true, data: { menu, count: menu.length } };
    }

    async checkAvailability(date, time, guests) {
        // Simple availability check - in production, this would check a database
        // Assume available for now
        return {
            success: true,
            data: {
                available: true,
                date,
                time,
                guests,
                message: `Great news! We have availability for ${guests} guests on ${date} at ${time}.`
            }
        };
    }

    async createBooking({ date, time, guests, name, phone, notes = '' }) {
        const booking = {
            id: `BK-${Date.now()}`,
            date,
            time,
            guests,
            name,
            phone,
            notes,
            status: 'confirmed',
            createdAt: new Date().toISOString()
        };

        // Save booking
        await this.saveBooking(booking);

        return {
            success: true,
            data: {
                booking,
                message: `✅ Booking confirmed for ${name} on ${date} at ${time} for ${guests} guests. Confirmation sent to ${phone}.`
            }
        };
    }

    async saveBooking(booking) {
        try {
            const ordersDir = join(projectRoot, 'data/orders');
            await fs.mkdir(ordersDir, { recursive: true });
            const filePath = join(ordersDir, 'bookings.json');

            let bookings = [];
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                bookings = JSON.parse(data);
            } catch (e) { }

            bookings.push(booking);
            await fs.writeFile(filePath, JSON.stringify(bookings, null, 2));
        } catch (err) {
            console.error('❌ Error saving booking:', err.message);
        }
    }

    async takeOrder({ items, customerName, customerPhone, delivery = false, address = '' }) {
        let total = 0;
        const orderItems = items.map(item => {
            const price = typeof item.price === 'number' ? item.price : parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
            total += price * item.quantity;
            return { ...item, price, total: price * item.quantity };
        });

        const order = {
            id: `ORD-${Date.now()}`,
            items: orderItems,
            total,
            customerName,
            customerPhone,
            delivery,
            address,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Save order
        await this.saveOrder(order);

        return {
            success: true,
            data: {
                order,
                message: `📦 Order #${order.id} received!\n\n${orderItems.map(i => `• ${i.quantity}x ${i.name} - R${i.total}`).join('\n')}\n\nTotal: R${total}\n\n${delivery ? `🚚 Delivery to: ${address}` : '🏠 Pickup'}\n\nWe'll confirm when ready!`
            }
        };
    }

    async saveOrder(order) {
        try {
            const ordersDir = join(projectRoot, 'data/orders');
            await fs.mkdir(ordersDir, { recursive: true });
            const filePath = join(ordersDir, 'orders.json');

            let orders = [];
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                orders = JSON.parse(data);
            } catch (e) { }

            orders.push(order);
            await fs.writeFile(filePath, JSON.stringify(orders, null, 2));
        } catch (err) {
            console.error('❌ Error saving order:', err.message);
        }
    }

    async getDirections() {
        const mapsUrl = this.businessConfig.location?.googleMapsUrl ||
            `https://www.google.com/maps/search/${encodeURIComponent(this.businessConfig.name + ' ' + this.businessConfig.location?.address)}`;

        return {
            success: true,
            data: {
                address: this.businessConfig.location?.address || '',
                city: this.businessConfig.location?.city || '',
                mapsUrl,
                message: `📍 ${this.businessConfig.name}\n${this.businessConfig.location?.address || ''}, ${this.businessConfig.location?.city || ''}\n\n[Open in Google Maps](${mapsUrl})`
            }
        };
    }

    async handleComplaint({ customerName, customerPhone, issue, urgency = 'medium' }) {
        const complaint = {
            id: `CMPL-${Date.now()}`,
            customerName,
            customerPhone,
            issue,
            urgency,
            status: 'open',
            createdAt: new Date().toISOString()
        };

        // Save complaint
        await this.saveComplaint(complaint);

        const response = {
            success: true,
            data: {
                complaint,
                message: urgency === 'high'
                    ? `⚠️ I've escalated your concern to our management. We'll contact you shortly at ${customerPhone}.`
                    : `I'm truly sorry about your experience. I've logged your feedback and we'll use it to improve. Thank you for letting us know.`
            }
        };

        // High urgency = escalate
        if (urgency === 'high') {
            await this.escalate({
                reason: `Customer complaint: ${issue}`,
                customerInfo: `${customerName} - ${customerPhone}`,
                details: `Urgency: ${urgency}`
            });
        }

        return response;
    }

    async saveComplaint(complaint) {
        try {
            const ordersDir = join(projectRoot, 'data/orders');
            await fs.mkdir(ordersDir, { recursive: true });
            const filePath = join(ordersDir, 'complaints.json');

            let complaints = [];
            try {
                const data = await fs.readFile(filePath, 'utf-8');
                complaints = JSON.parse(data);
            } catch (e) { }

            complaints.push(complaint);
            await fs.writeFile(filePath, JSON.stringify(complaints, null, 2));
        } catch (err) {
            console.error('❌ Error saving complaint:', err.message);
        }
    }

    async collectFeedback({ customerName, rating, comment = '' }) {
        const feedback = {
            id: `FB-${Date.now()}`,
            customerName,
            rating,
            comment,
            createdAt: new Date().toISOString()
        };

        return {
            success: true,
            data: {
                feedback,
                message: `Thank you for your feedback! ${'⭐'.repeat(rating)} (${rating}/5)\n\n${comment ? `Your comment: "${comment}"` : ''}\n\nWe appreciate your business!`
            }
        };
    }

    async escalate({ reason, customerInfo = '', details = '' }) {
        // In production, this would send a notification to the owner
        const escalation = {
            id: `ESC-${Date.now()}`,
            reason,
            customerInfo,
            details,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        console.log(`🚨 ESCALATION: ${reason}`);
        console.log(`   Customer: ${customerInfo}`);
        console.log(`   Details: ${details}`);

        return {
            success: true,
            data: {
                escalation,
                message: `⚠️ Your concern has been escalated to our management team. They will contact you as soon as possible.`
            }
        };
    }

    async searchKnowledge(query) {
        // Search through business knowledge files
        const knowledgeDir = join(projectRoot, 'data/business');
        let results = [];

        try {
            const files = await fs.readdir(knowledgeDir);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    const content = await fs.readFile(join(knowledgeDir, file), 'utf-8');
                    if (content.toLowerCase().includes(query.toLowerCase())) {
                        results.push({ file, content: content.substring(0, 500) });
                    }
                }
            }
        } catch (err) {
            // Knowledge directory may not exist yet
        }

        return {
            success: true,
            data: {
                query,
                results,
                message: results.length > 0
                    ? `Found ${results.length} result(s) for "${query}"`
                    : `No specific information found for "${query}". Please contact us directly.`
            }
        };
    }

    async calculatePrice(items) {
        let total = 0;
        const breakdown = items.map(item => {
            const subtotal = item.quantity * item.unitPrice;
            total += subtotal;
            return {
                name: item.name,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal
            };
        });

        return {
            success: true,
            data: {
                items: breakdown,
                total,
                message: breakdown.map(i => `• ${i.quantity}x ${i.name} = R${i.subtotal}`).join('\n') + `\n\nTotal: R${total}`
            }
        };
    }
}

export { toolDefinitions };
export default ToolExecutor;
