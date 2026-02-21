import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

class Gateway extends EventEmitter {
    constructor(port = 18789) {
        super();
        this.port = port;
        this.sessions = new Map();
        this.channels = new Map();
        this.wss = null;
        this.clients = new Set();
    }

    start() {
        this.wss = new WebSocketServer({ port: this.port, host: '127.0.0.1' });

        this.wss.on('connection', (ws) => {
            this.clients.add(ws);
            console.log(`📡 Gateway: Client connected (${this.clients.size} total)`);

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleDashboardMessage(message, ws);
                } catch (err) {
                    console.error('❌ Gateway: Invalid message format', err.message);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log(`📡 Gateway: Client disconnected (${this.clients.size} total)`);
            });

            ws.on('error', (err) => {
                console.error('❌ Gateway: WebSocket error', err.message);
            });
        });

        console.log(`📡 Gateway listening on ws://127.0.0.1:${this.port}`);
    }

    handleDashboardMessage(message, ws) {
        const { type, payload } = message;

        switch (type) {
            case 'dashboard:ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
            case 'dashboard:getSessions':
                const sessions = Array.from(this.sessions.values()).map(s => ({
                    id: s.id,
                    customerName: s.metadata?.customerName || 'Unknown',
                    channel: s.metadata?.channel || 'unknown',
                    lastActive: s.lastActive,
                    messageCount: s.messages.length
                }));
                ws.send(JSON.stringify({ type: 'sessions', sessions }));
                break;
            case 'dashboard:sendMessage':
                if (payload?.sessionId && payload?.message) {
                    this.emit('admin:message', payload.sessionId, payload.message);
                }
                break;
            default:
                this.emit('dashboard:message', message, ws);
        }
    }

    async routeMessage(channelName, sessionId, message, metadata = {}) {
        // Create or get session
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, {
                id: sessionId,
                messages: [],
                metadata: { channel: channelName, ...metadata },
                lastActive: Date.now(),
                customerName: metadata.senderName || null,
                createdAt: Date.now()
            });
        }

        const session = this.sessions.get(sessionId);
        session.lastActive = Date.now();
        session.messages.push({
            role: 'user',
            content: message,
            timestamp: Date.now()
        });

        // Broadcast to dashboard
        this.broadcast({
            type: 'message:incoming',
            channel: channelName,
            sessionId,
            senderName: metadata.senderName,
            message,
            timestamp: Date.now()
        });

        // Emit for agent processing
        this.emit('message', { channelName, sessionId, message, metadata, session });
    }

    async sendResponse(channelName, sessionId, response) {
        const channel = this.channels.get(channelName);
        const session = this.sessions.get(sessionId);

        // Save to session history
        if (session) {
            session.messages.push({
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            });
        }

        // Broadcast to dashboard
        this.broadcast({
            type: 'message:outgoing',
            channel: channelName,
            sessionId,
            response,
            timestamp: Date.now()
        });

        // Send via channel
        if (channel && typeof channel.send === 'function') {
            await channel.send(sessionId, response);
        }
    }

    registerChannel(name, instance) {
        this.channels.set(name, instance);
        console.log(`📡 Gateway: Registered channel '${name}'`);
    }

    broadcast(data) {
        const msg = JSON.stringify(data);
        for (const client of this.clients) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(msg);
                } catch (err) {
                    console.error('❌ Broadcast error:', err.message);
                }
            }
        }
    }

    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    close() {
        if (this.wss) {
            this.wss.close();
            console.log('📡 Gateway: Closed');
        }
    }
}

export default Gateway;
