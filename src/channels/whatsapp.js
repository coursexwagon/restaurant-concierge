import makeWASocket, { useMultiFileAuthState, DisconnectReason } from 'baileys';
import { Boom } from '@hapi/boom';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pino from 'pino';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class WhatsAppChannel {
    constructor(gateway) {
        this.gateway = gateway;
        this.socket = null;
        this.sessions = new Map();
    }

    async start() {
        if (process.env.CHANNELS_WHATSAPP !== 'true') {
            console.log('📱 WhatsApp: Disabled in configuration');
            return;
        }

        console.log('📱 WhatsApp: Starting...');

        const authDir = join(projectRoot, 'auth/whatsapp');

        try {
            const { state, saveCreds } = await useMultiFileAuthState(authDir);

            this.socket = makeWASocket({
                auth: state,
                printQRInTerminal: true,
                logger: pino({ level: 'silent' }),
                browser: ['Restaurant Concierge', 'Chrome', '120.0.0']
            });

            // Handle credentials update
            this.socket.ev.on('creds.update', saveCreds);

            // Handle connections
            this.socket.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    console.log('📱 WhatsApp: Scan QR code below to connect:');
                    console.log(qr);
                }

                if (connection === 'close') {
                    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    const shouldReconnect = reason !== DisconnectReason.loggedOut;

                    console.log(`📱 WhatsApp: Connection closed (${reason}). Reconnecting: ${shouldReconnect}`);

                    if (shouldReconnect) {
                        this.start();
                    }
                } else if (connection === 'open') {
                    console.log('📱 WhatsApp: Connected!');
                }
            });

            // Handle incoming messages
            this.socket.ev.on('messages.upsert', async ({ messages }) => {
                for (const msg of messages) {
                    if (!msg.key.fromMe && msg.message) {
                        await this.handleIncomingMessage(msg);
                    }
                }
            });

        } catch (err) {
            console.error('❌ WhatsApp initialization failed:', err.message);
        }
    }

    async handleIncomingMessage(msg) {
        const jid = msg.key.remoteJid;
        const sender = jid.split('@')[0];
        const messageText = msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            '';

        if (!messageText) return;

        console.log(`📱 WhatsApp: Message from ${sender}: ${messageText.substring(0, 50)}...`);

        // Generate session ID from phone number
        const sessionId = `wa_${sender}`;

        // Route to gateway
        await this.gateway.routeMessage('whatsapp', sessionId, messageText, {
            senderName: sender,
            senderPhone: sender,
            platform: 'whatsapp'
        });
    }

    async send(sessionId, message) {
        if (!this.socket) {
            console.error('❌ WhatsApp: Not connected');
            return;
        }

        // Extract phone from session ID
        const phone = sessionId.replace('wa_', '');
        const jid = `${phone}@s.whatsapp.net`;

        try {
            await this.socket.sendMessage(jid, { text: message });
            console.log(`📱 WhatsApp: Sent to ${phone}: ${message.substring(0, 30)}...`);
        } catch (err) {
            console.error('❌ WhatsApp send error:', err.message);
        }
    }

    async sendToOwner(message) {
        const ownerPhone = process.env.OWNER_PHONE;
        if (!ownerPhone || !this.socket) return;

        const phone = ownerPhone.replace(/[^0-9]/g, '');
        const jid = `${phone}@s.whatsapp.net`;

        try {
            await this.socket.sendMessage(jid, { text: message });
        } catch (err) {
            console.error('❌ WhatsApp owner notification error:', err.message);
        }
    }

    isConnected() {
        return this.socket?.ws?.readyState === 1;
    }
}

export default WhatsAppChannel;
