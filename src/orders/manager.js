import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class OrdersManager {
    constructor(gateway) {
        this.gateway = gateway;
        this.orders = [];
        this.bookings = [];
        this.complaints = [];
    }

    async initialize() {
        console.log('📦 Initializing Orders Manager...');
        await this.loadOrders();
    }

    async loadOrders() {
        try {
            const ordersPath = join(projectRoot, 'data/orders/orders.json');
            const data = await fs.readFile(ordersPath, 'utf-8');
            this.orders = JSON.parse(data);
        } catch (err) {
            this.orders = [];
        }

        try {
            const bookingsPath = join(projectRoot, 'data/orders/bookings.json');
            const data = await fs.readFile(bookingsPath, 'utf-8');
            this.bookings = JSON.parse(data);
        } catch (err) {
            this.bookings = [];
        }

        try {
            const complaintsPath = join(projectRoot, 'data/orders/complaints.json');
            const data = await fs.readFile(complaintsPath, 'utf-8');
            this.complaints = JSON.parse(data);
        } catch (err) {
            this.complaints = [];
        }

        console.log(`✅ Loaded ${this.orders.length} orders, ${this.bookings.length} bookings`);
    }

    async saveOrders() {
        const ordersDir = join(projectRoot, 'data/orders');
        await fs.mkdir(ordersDir, { recursive: true });
        await fs.writeFile(join(ordersDir, 'orders.json'), JSON.stringify(this.orders, null, 2));
        await fs.writeFile(join(ordersDir, 'bookings.json'), JSON.stringify(this.bookings, null, 2));
        await fs.writeFile(join(ordersDir, 'complaints.json'), JSON.stringify(this.complaints, null, 2));
    }

    // Notifications
    async notifyOwner(type, data) {
        const notifyOrders = process.env.NOTIFY_ORDERS === 'true';
        const notifyComplaints = process.env.NOTIFY_COMPLAINTS === 'true';
        const ownerPhone = process.env.OWNER_PHONE;

        if (!ownerPhone) return;

        let message = '';

        switch (type) {
            case 'new_order':
                if (!notifyOrders) return;
                message = `🛒 NEW ORDER #${data.id}\n\n` +
                    `${data.items.map(i => `• ${i.quantity}x ${i.name}`).join('\n')}\n\n` +
                    `Total: R${data.total}\n` +
                    `Customer: ${data.customerName}\n` +
                    `${data.delivery ? `Delivery to: ${data.address}` : 'Pickup'}`;
                break;

            case 'new_booking':
                message = `📅 NEW BOOKING #${data.id}\n\n` +
                    `Date: ${data.date} at ${data.time}\n` +
                    `Guests: ${data.guests}\n` +
                    `Name: ${data.name}\n` +
                    `Phone: ${data.phone}`;
                break;

            case 'complaint':
                if (!notifyComplaints) return;
                message = `⚠️ CUSTOMER COMPLAINT #${data.id}\n\n` +
                    `Issue: ${data.issue}\n` +
                    `Customer: ${data.customerName}\n` +
                    `Phone: ${data.customerPhone}\n` +
                    `Urgency: ${data.urgency.toUpperCase()}`;
                break;
        }

        if (message) {
            console.log(`📱 Notifying owner: ${message.substring(0, 100)}...`);
            // In production, send via WhatsApp
            // this.sendWhatsAppMessage(ownerPhone, message);
        }
    }

    getStats() {
        const today = new Date().toISOString().split('T')[0];
        const todayOrders = this.orders.filter(o => o.createdAt.startsWith(today));
        const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.total || 0), 0);

        return {
            totalOrders: this.orders.length,
            todayOrders: todayOrders.length,
            todayRevenue,
            totalBookings: this.bookings.length,
            openComplaints: this.complaints.filter(c => c.status === 'open').length
        };
    }

    getRecentOrders(limit = 10) {
        return this.orders.slice(-limit).reverse();
    }

    getRecentBookings(limit = 10) {
        return this.bookings.slice(-limit).reverse();
    }
}

export default OrdersManager;
