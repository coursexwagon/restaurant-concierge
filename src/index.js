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
    console.log('  Autonomous AI Agent Platform');
    console.log('  🧠 Everlasting Memory | ⚡ Skills | 🔒 Secure');
    console.log('='.repeat(60) + '\n');

    // Check if configured
    let needsSetup = false;
    try {
        await fs.access(join(projectRoot, 'config/business.json'));
    } catch {
        needsSetup = true;
    }

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

    console.log('🔄 Starting components...\n');

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

    // Dashboard with all components
    const dashboard = new Dashboard(gateway, ordersManager, memoryStore, skillsManager);
    dashboard.start();

    // Register channels with gateway
    gateway.registerChannel('whatsapp', whatsapp);

    // Handle admin messages from dashboard
    gateway.on('admin:message', async (sessionId, message) => {
        await agent.processAdminMessage(sessionId, message);
    });

    // Log startup
    dashboard.logToTerminal('🤖 Agent initialized successfully');
    dashboard.logToTerminal(`🧠 Memory: ${memoryStore.customerMemory.size} customers loaded`);
    dashboard.logToTerminal(`⚡ Skills: ${skillsManager.skills.size} skills loaded`);
    dashboard.logToTerminal(`📚 Knowledge: ${knowledge.documents.length} documents loaded`);

    // Graceful shutdown
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    function shutdown() {
        console.log('\n\n🛑 Shutting down...');
        dashboard.logToTerminal('🛑 Agent shutting down...');
        gateway.close();
        process.exit(0);
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ Agent is running!');
    console.log('='.repeat(60));
    console.log('\n📱 Web Setup: http://localhost:' + (process.env.DASHBOARD_PORT || 3000) + '/setup.html');
    console.log('🌐 Dashboard: http://localhost:' + (process.env.DASHBOARD_PORT || 3000));
    console.log('📡 Gateway: ws://127.0.0.1:' + (process.env.GATEWAY_PORT || 18789));
    console.log('\n🧠 Features:');
    console.log('   • Everlasting Memory');
    console.log('   • Skills Management');
    console.log('   • Web Scraping');
    console.log('   • Training System');
    console.log('   • High Security (AES-256)');
    console.log('\nPress Ctrl+C to stop\n');
}

main().catch(err => {
    console.error('❌ Failed to start:', err);
    process.exit(1);
});
