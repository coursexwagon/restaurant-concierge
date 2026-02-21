import readline from 'readline';
import fs from 'fs/promises';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

const TEMPLATES = {
    restaurant: {
        skills: ['order-taking', 'booking', 'complaint-handling', 'review-response'],
        defaultHours: 'Mon-Sun: 10:00-22:00',
        sampleFAQ: [
            { q: 'Do you deliver?', a: 'Yes, we deliver within a 10km radius.' },
            { q: 'Can I book a table?', a: 'Yes! Tell me the date, time, and number of guests.' },
            { q: 'Do you have vegan options?', a: 'Yes, we have several vegan dishes.' }
        ],
        personality: 'warm, friendly, food-enthusiastic'
    },
    salon: {
        skills: ['booking', 'complaint-handling', 'review-response'],
        defaultHours: 'Mon-Sat: 08:00-18:00, Sun: Closed',
        sampleFAQ: [
            { q: 'Do I need an appointment?', a: 'Walk-ins welcome but appointments recommended.' },
            { q: 'What services do you offer?', a: 'Haircuts, styling, colouring, treatments, nails.' }
        ],
        personality: 'professional, caring, beauty-focused'
    },
    bnb: {
        skills: ['booking', 'complaint-handling', 'review-response'],
        defaultHours: 'Check-in: 14:00-20:00, Check-out: by 10:00',
        sampleFAQ: [
            { q: 'Is breakfast included?', a: 'Yes, full breakfast included.' },
            { q: 'Do you have parking?', a: 'Yes, free secure parking on-site.' }
        ],
        personality: 'hospitable, warm, local-expert'
    },
    general: {
        skills: ['complaint-handling', 'review-response'],
        defaultHours: 'Mon-Fri: 08:00-17:00',
        sampleFAQ: [],
        personality: 'professional, helpful, efficient'
    }
};

function printHeader() {
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 RESTAURANT CONCIERGE AGENT — Business Setup Wizard');
    console.log('  Setting up your AI agent in under 5 minutes');
    console.log('='.repeat(60) + '\n');
}

function printStep(step, title, subtitle) {
    console.log('\n' + '─'.repeat(60));
    console.log(`📋 STEP ${step}: ${title}`);
    console.log(`   ${subtitle}`);
    console.log('─'.repeat(60));
}

export async function runOnboarding() {
    printHeader();

    // Step 1: Business basics
    printStep(1, 'Your Business', 'Tell us about your business');

    const businessName = await ask('  Business name: ');
    const businessType = await ask('  Type (restaurant/salon/bnb/general): ');
    const template = TEMPLATES[businessType] || TEMPLATES.general;
    const location = await ask('  Physical address: ');
    const city = await ask('  City: ');
    const phone = await ask('  Phone number: ');
    const email = await ask('  Email (optional): ');

    // Step 2: Operating details
    printStep(2, 'Operating Details', 'When are you open?');

    const hours = await ask(`  Hours (Enter for default: ${template.defaultHours}): `);
    const description = await ask('  Describe your business in one sentence: ');

    // Step 3: Services/Menu
    printStep(3, 'Menu & Services', 'What do you offer? (Enter done when finished)');

    console.log('  Enter items (format: "Item - Price"), type "done" when finished:\n');
    const services = [];
    while (true) {
        const item = await ask('  > ');
        if (item.toLowerCase() === 'done') break;
        if (item.trim()) services.push(item);
    }

    // Step 4: AI Configuration
    printStep(4, 'AI Brain', 'Choose your AI provider');

    console.log('  Providers: openai, anthropic, ollama, openrouter, deepseek, groq');
    console.log('  (openrouter recommended - 300+ models, free tier available)\n');
    const llmProvider = await ask('  LLM provider: ');
    let apiKey = '';
    if (llmProvider !== 'ollama') {
        apiKey = await ask(`  ${llmProvider.toUpperCase()} API key: `);
    }
    const model = await ask('  Model (press Enter for auto-select): ');

    // Step 5: Channels
    printStep(5, 'Communication Channels', 'Where should customers reach you?');

    const useWhatsApp = (await ask('  Enable WhatsApp? (y/n): ')).toLowerCase() === 'y';
    const useTelegram = (await ask('  Enable Telegram? (y/n): ')).toLowerCase() === 'y';
    const useWebChat = (await ask('  Enable web dashboard? (y/n): ')).toLowerCase() === 'y';

    // Step 6: Owner notifications
    printStep(6, 'Owner Notifications', 'Where should we send alerts?');

    const ownerPhone = await ask('  Owner WhatsApp number: ');
    const notifyOnOrder = (await ask('  Notify on new orders? (y/n): ')).toLowerCase() === 'y';
    const notifyOnComplaint = (await ask('  Notify on complaints? (y/n): ')).toLowerCase() === 'y';
    rl.close();

    // === GENERATE ALL CONFIG FILES ===
    console.log('\n' + '='.repeat(60));
    console.log('  🔧 Generating configuration files...');
    console.log('='.repeat(60) + '\n');

    const projectRoot = join(__dirname, '../..');

    // business.json
    const businessConfig = {
        name: businessName,
        type: businessType,
        location: {
            address: location,
            city,
            googleMapsUrl: `https://www.google.com/maps/search/${encodeURIComponent(businessName + ' ' + location + ' ' + city)}`
        },
        contact: { phone, email: email || null },
        hours: hours || template.defaultHours,
        description,
        services,
        createdAt: new Date().toISOString()
    };

    await fs.mkdir(join(projectRoot, 'config'), { recursive: true });
    await fs.writeFile(join(projectRoot, 'config/business.json'), JSON.stringify(businessConfig, null, 2));
    console.log('  ✅ config/business.json');

    // .env
    const envContent = [
        `LLM_PROVIDER=${llmProvider}`,
        `LLM_MODEL=${model}`,
        llmProvider === 'openai' ? `OPENAI_API_KEY=${apiKey}` : '',
        llmProvider === 'anthropic' ? `ANTHROPIC_API_KEY=${apiKey}` : '',
        llmProvider === 'ollama' ? 'OLLAMA_BASE_URL=http://localhost:11434' : '',
        `AGENT_NAME=${businessName} AI`,
        `OWNER_PHONE=${ownerPhone}`,
        `NOTIFY_ORDERS=${notifyOnOrder}`,
        `NOTIFY_COMPLAINTS=${notifyOnComplaint}`,
        `CHANNELS_WHATSAPP=${useWhatsApp}`,
        `CHANNELS_TELEGRAM=${useTelegram}`,
        `CHANNELS_WEB=${useWebChat}`,
        `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`,
        `ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`,
        'DASHBOARD_PORT=3000',
    ].filter(Boolean).join('\n');

    await fs.writeFile(join(projectRoot, '.env'), envContent);
    console.log('  ✅ .env (security keys auto-generated)');

    // SOUL.md
    const soulContent = `# ${businessName} AI — Soul

## Core Truths
- I am the AI assistant for ${businessName}, a ${businessType} in ${city}.
- I genuinely care about every customer's experience.
- I am ${template.personality}.
- I never make up information — if I don't know, I say so.

## Boundaries
- Never share business financial info
- Never process payments directly
- Never share other customers' info
- Escalate urgent/dangerous situations to owner immediately

## Communication Style
- Warm but professional
- Keep messages WhatsApp-friendly (concise)
- Respond in customer's language
`;
    await fs.writeFile(join(projectRoot, 'config/SOUL.md'), soulContent);
    console.log('  ✅ config/SOUL.md');

    // Business knowledge files
    await fs.mkdir(join(projectRoot, 'data/business'), { recursive: true });
    await fs.writeFile(join(projectRoot, 'data/business/menu.md'), `# ${businessName} — Menu/Services\n\n${services.map(s => `- ${s}`).join('\n')}`);
    await fs.writeFile(join(projectRoot, 'data/business/hours.md'), `# Hours\n\n${hours || template.defaultHours}`);
    await fs.writeFile(join(projectRoot, 'data/business/faq.md'), `# FAQ\n\n${template.sampleFAQ.map(f => `**Q: ${f.q}**\nA: ${f.a}\n`).join('\n')}`);

    // Create directories
    const dirs = [
        'data/memory/conversations',
        'data/vectors',
        'data/orders',
        'skills/auto-generated',
        'auth/whatsapp',
        'branding'
    ];
    for (const dir of dirs) {
        await fs.mkdir(join(projectRoot, dir), { recursive: true });
    }

    console.log('\n' + '='.repeat(60));
    console.log('  ✅ SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\n  Next steps:');
    console.log('  1. Edit .env with your API key (if not set)');
    console.log('  2. Run: node src/index.js');
    console.log('  3. Open http://localhost:3000 for dashboard\n');
}

// Run if called directly
if (import.meta.url === process.argv[1]) {
    runOnboarding().catch(console.error);
}
