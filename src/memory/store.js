import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

/**
 * Everlasting Memory System
 * - Persists forever until explicitly deleted
 * - Auto-learns from conversations
 * - Structured memory with categories
 * - Can import/export memory
 */
class MemoryStore {
    constructor() {
        this.customerMemory = new Map();      // Customer profiles
        this.conversations = new Map();       // Conversation history
        this.learnedPatterns = new Map();     // Auto-learned patterns
        this.businessKnowledge = new Map();    // Business-specific knowledge
        this.skills = new Map();              // Custom skills
        this.trainingData = new Map();        // Training corrections
    }

    async initialize() {
        console.log('🧠 Initializing Everlasting Memory System...');

        // Load all memory stores
        await this.loadCustomerMemory();
        await this.loadLearnedPatterns();
        await this.loadBusinessKnowledge();
        await this.loadSkills();
        await this.loadTrainingData();

        console.log(`✅ Memory loaded: ${this.customerMemory.size} customers, ${this.learnedPatterns.size} learned patterns`);
    }

    // ==================== Customer Memory ====================

    async loadCustomerMemory() {
        try {
            const path = join(projectRoot, 'data/memory/customer-memory.json');
            const data = await fs.readFile(path, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [phone, info] of Object.entries(parsed)) {
                this.customerMemory.set(phone, info);
            }
        } catch (err) {
            // First run - no memory yet
        }
    }

    async saveCustomerMemory() {
        const data = {};
        for (const [phone, info] of this.customerMemory) {
            data[phone] = info;
        }

        const memDir = join(projectRoot, 'data/memory');
        await fs.mkdir(memDir, { recursive: true });
        await fs.writeFile(join(memDir, 'customer-memory.json'), JSON.stringify(data, null, 2));
    }

    // Get customer memory (returns existing or creates new)
    getCustomer(phone) {
        const normalized = this.normalizePhone(phone);
        return this.customerMemory.get(normalized) || {
            phone: normalized,
            name: null,
            preferences: {},
            orderHistory: [],
            facts: [],
            tags: [],
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            totalSpent: 0,
            visitCount: 0
        };
    }

    // Remember a customer
    async rememberCustomer(phone, data = {}) {
        const normalized = this.normalizePhone(phone);
        const existing = this.getCustomer(normalized);

        const updated = {
            ...existing,
            ...data,
            phone: normalized,
            lastSeen: new Date().toISOString(),
            visitCount: (existing.visitCount || 0) + 1
        };

        if (data.name && !existing.name) {
            updated.name = data.name;
        }

        this.customerMemory.set(normalized, updated);
        await this.saveCustomerMemory();

        return updated;
    }

    // Add a fact about a customer
    async addCustomerFact(phone, fact, category = 'general') {
        const normalized = this.normalizePhone(phone);
        const customer = this.getCustomer(normalized);

        customer.facts = customer.facts || [];
        customer.facts.push({
            fact,
            category,
            createdAt: new Date().toISOString()
        });

        customer.lastSeen = new Date().toISOString();
        this.customerMemory.set(normalized, customer);
        await this.saveCustomerMemory();
    }

    // Add preference
    async addPreference(phone, key, value) {
        const normalized = this.normalizePhone(phone);
        const customer = this.getCustomer(normalized);

        customer.preferences = customer.preferences || {};
        customer.preferences[key] = value;

        this.customerMemory.set(normalized, customer);
        await this.saveCustomerMemory();
    }

    // Get all customers
    getAllCustomers() {
        return Array.from(this.customerMemory.values());
    }

    // Delete customer memory
    async deleteCustomer(phone) {
        const normalized = this.normalizePhone(phone);
        this.customerMemory.delete(normalized);
        await this.saveCustomerMemory();
    }

    // Clear ALL memory
    async clearAllMemory() {
        this.customerMemory.clear();
        await this.saveCustomerMemory();
    }

    // ==================== Auto-Learning ====================

    async loadLearnedPatterns() {
        try {
            const path = join(projectRoot, 'data/memory/learned-patterns.json');
            const data = await fs.readFile(path, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [key, value] of Object.entries(parsed)) {
                this.learnedPatterns.set(key, value);
            }
        } catch (err) { }
    }

    async saveLearnedPatterns() {
        const data = {};
        for (const [key, value] of this.learnedPatterns) {
            data[key] = value;
        }

        const memDir = join(projectRoot, 'data/memory');
        await fs.writeFile(join(memDir, 'learned-patterns.json'), JSON.stringify(data, null, 2));
    }

    // Learn from conversation (auto-detect patterns)
    async learnFromConversation(phone, messages) {
        // Extract preferences from conversation
        const preferences = this.extractPreferences(messages);

        for (const [key, value] of Object.entries(preferences)) {
            await this.addPreference(phone, key, value);
        }

        // Learn common phrases/patterns
        const pattern = this.learnPattern(messages);
        if (pattern) {
            this.learnedPatterns.set(pattern.trigger, pattern.response);
            await this.saveLearnedPatterns();
        }
    }

    extractPreferences(messages) {
        const prefs = {};
        const text = messages.map(m => m.content).join(' ').toLowerCase();

        // Simple preference detection
        if (text.includes('vegetarian') || text.includes('vegan')) {
            prefs.dietary = 'vegetarian/vegan';
        }
        if (text.includes('spicy')) {
            prefs.spiceLevel = 'prefers spicy';
        }
        if (text.includes('allergy') || text.includes('allergic')) {
            const match = text.match(/allergy.*?(?:to|is)\s+(\w+)/i);
            if (match) prefs.allergy = match[1];
        }

        return prefs;
    }

    learnPattern(messages) {
        // Look for explicit teaching: "Always say X when Y"
        const text = messages.map(m => m.content).join(' ');
        const match = text.match(/(?:always|when|if).*?(?:say|respond).*?["'](.+?)["']/i);

        if (match) {
            return {
                trigger: 'custom',
                response: match[1],
                learnedAt: new Date().toISOString()
            };
        }
        return null;
    }

    getLearnedPatterns() {
        return Object.fromEntries(this.learnedPatterns);
    }

    // ==================== Business Knowledge ====================

    async loadBusinessKnowledge() {
        try {
            const path = join(projectRoot, 'data/memory/business-knowledge.json');
            const data = await fs.readFile(path, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [key, value] of Object.entries(parsed)) {
                this.businessKnowledge.set(key, value);
            }
        } catch (err) { }
    }

    async saveBusinessKnowledge() {
        const data = {};
        for (const [key, value] of this.businessKnowledge) {
            data[key] = value;
        }

        await fs.writeFile(join(projectRoot, 'data/memory/business-knowledge.json'), JSON.stringify(data, null, 2));
    }

    // Add business knowledge
    async addBusinessKnowledge(key, value) {
        this.businessKnowledge.set(key, {
            value,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        await this.saveBusinessKnowledge();
    }

    getBusinessKnowledge(key) {
        return this.businessKnowledge.get(key);
    }

    // ==================== Skills Management ====================

    async loadSkills() {
        try {
            // Load custom skills
            const skillsDir = join(projectRoot, 'skills');
            const dirs = await fs.readdir(skillsDir);

            for (const dir of dirs) {
                try {
                    const skillPath = join(skillsDir, dir, 'SKILL.md');
                    const content = await fs.readFile(skillPath, 'utf-8');
                    this.skills.set(dir, {
                        name: dir,
                        content,
                        type: dir.includes('auto-generated') ? 'learned' : 'custom',
                        loadedAt: new Date().toISOString()
                    });
                } catch (err) { }
            }
        } catch (err) { }
    }

    async saveSkill(skillName, content) {
        const skillsDir = join(projectRoot, 'skills', skillName);
        await fs.mkdir(skillsDir, { recursive: true });
        await fs.writeFile(join(skillsDir, 'SKILL.md'), content);

        this.skills.set(skillName, {
            name: skillName,
            content,
            type: 'custom',
            savedAt: new Date().toISOString()
        });
    }

    getSkills() {
        return Array.from(this.skills.values());
    }

    getSkill(skillName) {
        return this.skills.get(skillName);
    }

    async deleteSkill(skillName) {
        this.skills.delete(skillName);
        // In production, also delete the file
    }

    // ==================== Training Data ====================

    async loadTrainingData() {
        try {
            const path = join(projectRoot, 'data/memory/training.json');
            const data = await fs.readFile(path, 'utf-8');
            const parsed = JSON.parse(data);
            for (const [key, value] of Object.entries(parsed)) {
                this.trainingData.set(key, value);
            }
        } catch (err) { }
    }

    async saveTrainingData() {
        const data = {};
        for (const [key, value] of this.trainingData) {
            data[key] = value;
        }
        await fs.writeFile(join(projectRoot, 'data/memory/training.json'), JSON.stringify(data, null, 2));
    }

    // Add training correction
    async addCorrection(incorrect, correct) {
        const id = `corr_${Date.now()}`;
        this.trainingData.set(id, {
            incorrect,
            correct,
            addedAt: new Date().toISOString(),
            timesApplied: 0
        });
        await this.saveTrainingData();
    }

    getTrainingCorrections() {
        return Array.from(this.trainingData.values());
    }

    // ==================== Import/Export ====================

    async exportMemory() {
        return {
            customers: Object.fromEntries(this.customerMemory),
            patterns: Object.fromEntries(this.learnedPatterns),
            knowledge: Object.fromEntries(this.businessKnowledge),
            skills: Object.fromEntries(this.skills),
            training: Object.fromEntries(this.trainingData),
            exportedAt: new Date().toISOString()
        };
    }

    async importMemory(data) {
        if (data.customers) {
            for (const [phone, info] of Object.entries(data.customers)) {
                this.customerMemory.set(phone, info);
            }
        }
        if (data.patterns) {
            for (const [key, value] of Object.entries(data.patterns)) {
                this.learnedPatterns.set(key, value);
            }
        }
        // Save all
        await this.saveCustomerMemory();
        await this.saveLearnedPatterns();
        await this.saveBusinessKnowledge();
    }

    // ==================== Helpers ====================

    normalizePhone(phone) {
        if (!phone) return '';
        // Remove all non-digits, keep leading +
        return phone.replace(/[^\d+]/g, '');
    }

    // Get conversation history
    getConversation(sessionId) {
        return this.conversations.get(sessionId) || [];
    }

    addToConversation(sessionId, role, content) {
        if (!this.conversations.has(sessionId)) {
            this.conversations.set(sessionId, []);
        }

        const conv = this.conversations.get(sessionId);
        conv.push({ role, content, timestamp: Date.now() });

        // Keep last 100 messages per conversation
        if (conv.length > 100) {
            conv.shift();
        }
    }
}

export default MemoryStore;
