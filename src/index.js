import { config } from 'dotenv';
config();

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 RESTAURANT CONCIERGE AGENT');
    console.log('  Server Running - Open Browser to Setup');
    console.log('='.repeat(60) + '\n');

    // Always start server - NEVER run wizard automatically
    // Browser handles all onboarding via setup.html

    // Import components
    const Gateway = (await import('./gateway/server.js')).default;
    const AgentRuntime = (await import('./agent/runtime.js')).default;
    const WhatsAppChannel = (await import('./channels/whatsapp.js')).default;
    const Dashboard = (await import('./dashboard/server.js')).default;
    const OrdersManager = (await import('./orders/manager.js')).default;
    const MemoryStore = (await import('./memory/store.js')).default;
    const SkillsManager = (await import('./skills/manager.js')).default;
    const RAGSystem = (await import('./knowledge/rag.js')).default;
    const WebScraper = (await import('./knowledge/web-scraper.js')).default;

    console.log('🔄 Starting server...\n');

    // Gateway
    const gateway = new Gateway(parseInt(process.env.GATEWAY_PORT) || 18789);
    gateway.start();

    // Orders Manager
    const ordersManager = new OrdersManager(gateway);
    await ordersManager.initialize();

    // Memory (Everlasting)
    const memoryStore = new MemoryStore();
    await memoryStore.initialize();

    // Skills Manager
    const skillsManager = new SkillsManager();
    await skillsManager.initialize();

    // Knowledge (RAG)
    const knowledge = new RAGSystem();
    await knowledge.initialize();

    // Web Scraper
    const webScraper = new WebScraper();

    // Agent Runtime
    const agent = new AgentRuntime(gateway, memoryStore, skillsManager);
    await agent.initialize();

    // WhatsApp Channel
    const whatsapp = new WhatsAppChannel(gateway);
    await whatsapp.start();

    // Dashboard with all components - handles setup in browser!
    const dashboard = new Dashboard(gateway, ordersManager, memoryStore, skillsManager);
    dashboard.start();

    // Register channels with gateway
    gateway.registerChannel('whatsapp', whatsapp);

    // Handle admin messages from dashboard
    gateway.on('admin:message', async (sessionId, message) => {
        await agent.processAdminMessage(sessionId, message);
    });

    // Log startup
    dashboard.logToTerminal('🤖 Server started - open browser to setup!');
    dashboard.logToTerminal('🌐 Go to: http://localhost:3000/setup.html');

    // Graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    function shutdown() {
        console.log('\n\n🛑 Shutting down...');
        dashboard.logToTerminal('🛑 Server shutting down...');
        gateway.close();
        process.exit(0);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ Server is running!');
    console.log('='.repeat(60));
    console.log('\n📱 OPEN IN BROWSER:');
    console.log('   Setup: http://localhost:3000/setup.html');
    console.log('   Dashboard: http://localhost:3000');
    console.log('\n⏳ Waiting for browser setup...\n');
}

main().catch(err => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});
