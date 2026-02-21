import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { encrypt, decrypt, sanitizeInput, logSecurityEvent } from '../security/encryption.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class Dashboard {
    constructor(gateway, ordersManager, memoryStore, skillsManager) {
        this.gateway = gateway;
        this.ordersManager = ordersManager;
        this.memoryStore = memoryStore;
        this.skillsManager = skillsManager;
        this.app = express();
        this.server = createServer(this.app);
        this.io = new Server(this.server);
        this.port = process.env.DASHBOARD_PORT || 3000;
        this.terminalLogs = [];
    }

    start() {
        console.log('🌐 Dashboard: Starting...');

        // Middleware
        this.app.use(express.json());
        this.app.use(express.static(join(projectRoot, 'src/dashboard/public')));

        // API Routes
        this.setupRoutes();

        // Socket.IO
        this.setupSocketIO();

        // Start server
        this.server.listen(this.port, () => {
            console.log(`🌐 Dashboard: http://localhost:${this.port}`);
            console.log(`🌐 Setup: http://localhost:${this.port}/setup.html`);
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Setup endpoint - handle new setup
        this.app.post('/api/setup', async (req, res) => {
            try {
                const { business, ai, channels, notifications, ownerPhone } = req.body;

                logSecurityEvent({ type: 'setup', business: business?.name });

                // Save business config
                const businessConfig = {
                    name: business?.name || 'My Restaurant',
                    type: business?.type || 'restaurant',
                    location: {
                        address: business?.address || '',
                        city: business?.city || '',
                        googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(business?.name + ' ' + business?.address)}`
                    },
                    contact: { phone: ownerPhone, email: null },
                    hours: 'Mon-Sun: 10:00-22:00',
                    description: '',
                    services: [],
                    createdAt: new Date().toISOString()
                };

                await fs.mkdir(join(projectRoot, 'config'), { recursive: true });
                await fs.writeFile(join(projectRoot, 'config/business.json'), JSON.stringify(businessConfig, null, 2));

                // Save AI config (with encrypted API key)
                let envContent = `LLM_PROVIDER=${ai?.provider || 'openrouter'}\n`;
                envContent += `LLM_MODEL=${ai?.model || ''}\n`;

                if (ai?.apiKey) {
                    const encryptedKey = encrypt(ai.apiKey);
                    if (ai.provider === 'openrouter') {
                        envContent += `OPENAI_API_KEY=${encryptedKey}\n`;
                    } else if (ai.provider === 'openai') {
                        envContent += `OPENAI_API_KEY=${encryptedKey}\n`;
                    } else if (ai.provider === 'anthropic') {
                        envContent += `ANTHROPIC_API_KEY=${encryptedKey}\n`;
                    }
                }

                envContent += `OWNER_PHONE=${ownerPhone || ''}\n`;
                envContent += `CHANNELS_WHATSAPP=${channels?.whatsapp || true}\n`;
                envContent += `CHANNELS_WEB=${channels?.web || true}\n`;
                envContent += `CHANNELS_DASHBOARD=${channels?.dashboard || true}\n`;
                envContent += `NOTIFY_ORDERS=${notifications?.orders || true}\n`;
                envContent += `NOTIFY_COMPLAINTS=${notifications?.bookings || true}\n`;
                envContent += `JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")\n`;
                envContent += `ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")\n`;

                await fs.writeFile(join(projectRoot, '.env'), envContent);

                this.logToTerminal('✅ Setup completed successfully!');

                res.json({ success: true, message: 'Setup completed' });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Get stats
        this.app.get('/api/stats', (req, res) => {
            const stats = this.ordersManager?.getStats() || { todayOrders: 0, todayRevenue: 0 };
            const sessions = this.gateway?.getAllSessions() || [];

            res.json({
                ...stats,
                activeSessions: sessions.length,
                totalCustomers: this.memoryStore?.customerMemory?.size || 0,
                totalSkills: this.skillsManager?.skills?.size || 0
            });
        });

        // Get business info
        this.app.get('/api/business', async (req, res) => {
            try {
                const data = await fs.readFile(join(projectRoot, 'config/business.json'), 'utf-8');
                res.json(JSON.parse(data));
            } catch (err) {
                res.json({ name: 'Not configured', type: 'restaurant' });
            }
        });

        // Save business info
        this.app.post('/api/business', async (req, res) => {
            try {
                const config = req.body;
                await fs.writeFile(join(projectRoot, 'config/business.json'), JSON.stringify(config, null, 2));
                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Get memory
        this.app.get('/api/memory', (req, res) => {
            const customers = this.memoryStore?.getAllCustomers() || [];
            res.json(customers);
        });

        // Delete memory
        this.app.delete('/api/memory/:phone', async (req, res) => {
            await this.memoryStore?.deleteCustomer(req.params.phone);
            res.json({ success: true });
        });

        // Clear all memory
        this.app.delete('/api/memory', async (req, res) => {
            await this.memoryStore?.clearAllMemory();
            res.json({ success: true });
        });

        // Get skills
        this.app.get('/api/skills', (req, res) => {
            const skills = this.skillsManager?.getAllSkills() || [];
            res.json(skills);
        });

        // Create skill
        this.app.post('/api/skills', async (req, res) => {
            try {
                const { name, content } = req.body;
                const skill = await this.skillsManager?.createSkill(name, content);
                res.json({ success: true, skill });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Delete skill
        this.app.delete('/api/skills/:name', async (req, res) => {
            await this.skillsManager?.deleteSkill(req.params.name);
            res.json({ success: true });
        });

        // Training
        this.app.post('/api/train', async (req, res) => {
            try {
                const { incorrect, correct } = req.body;
                await this.memoryStore?.addCorrection(incorrect, correct);

                // Auto-learn skill if needed
                if (incorrect && correct) {
                    await this.skillsManager?.autoLearnSkill(incorrect, correct);
                }

                res.json({ success: true });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // Get training corrections
        this.app.get('/api/train', (req, res) => {
            const corrections = this.memoryStore?.getTrainingCorrections() || [];
            res.json(corrections);
        });

        // Terminal logs
        this.app.get('/api/terminal/logs', (req, res) => {
            res.json(this.terminalLogs);
        });

        // Security
        this.app.get('/api/security/log', (req, res) => {
            const { getSecurityLog } = require('../security/encryption.js');
            res.json(getSecurityLog());
        });

        // Orders
        this.app.get('/api/orders', (req, res) => {
            const orders = this.ordersManager?.getRecentOrders(20) || [];
            res.json(orders);
        });

        // Activity
        this.app.get('/api/activity', (req, res) => {
            const sessions = this.gateway?.getAllSessions() || [];
            const activities = [];

            for (const session of sessions.slice(-20).reverse()) {
                const lastMsg = session.messages[session.messages.length - 1];
                if (lastMsg) {
                    activities.push({
                        sessionId: session.id,
                        channel: session.metadata?.channel,
                        senderName: session.metadata?.senderName || 'Unknown',
                        message: lastMsg.content,
                        role: lastMsg.role,
                        timestamp: lastMsg.timestamp
                    });
                }
            }

            res.json(activities);
        });

        // Send message to session
        this.app.post('/api/sessions/:sessionId/message', async (req, res) => {
            const { sessionId } = req.params;
            const { message } = req.body;

            if (!message) {
                return res.status(400).json({ error: 'Message required' });
            }

            // Sanitize input
            const sanitized = sanitizeInput(message);
            this.gateway.emit('admin:message', sessionId, sanitized);

            res.json({ success: true });
        });
    }

    setupSocketIO() {
        this.io.on('connection', (socket) => {
            console.log('🌐 Dashboard: Client connected');

            // Send initial data
            socket.emit('stats', this.ordersManager?.getStats() || {});
            socket.emit('sessions', this.gateway?.getAllSessions() || []);

            // Handle messages from dashboard
            socket.on('sendMessage', ({ sessionId, message }) => {
                const sanitized = sanitizeInput(message);
                this.gateway.emit('admin:message', sessionId, sanitized);
            });

            socket.on('ping', () => {
                socket.emit('pong', { timestamp: Date.now() });
            });
        });

        // Forward gateway broadcasts to dashboard clients
        const originalBroadcast = this.gateway.broadcast.bind(this.gateway);
        this.gateway.broadcast = (data) => {
            this.io.emit('event', data);

            // Also log to terminal
            if (data.type === 'message:incoming' || data.type === 'message:outgoing') {
                this.logToTerminal(`${data.type === 'message:incoming' ? '📥' : '📤'} [${data.channel}] ${data.senderName}: ${(data.message || data.response || '').substring(0, 50)}...`);
            }

            return originalBroadcast(data);
        };
    }

    logToTerminal(message) {
        const log = {
            time: new Date().toLocaleTimeString(),
            message
        };
        this.terminalLogs.push(log);

        // Keep only last 1000 logs
        if (this.terminalLogs.length > 1000) {
            this.terminalLogs.shift();
        }

        // Broadcast to connected clients
        this.io.emit('terminal:log', log);
    }
}

export default Dashboard;
