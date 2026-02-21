import LLMClient from './llm.js';
import ToolExecutor, { toolDefinitions } from './tools.js';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class AgentRuntime {
    constructor(gateway, memoryStore = null, skillsManager = null) {
        this.gateway = gateway;
        this.memoryStore = memoryStore;
        this.skillsManager = skillsManager;
        this.llm = null;
        this.tools = new ToolExecutor();
        this.maxToolCalls = 5;
        this.conversations = new Map();
    }

    async initialize() {
        console.log('🧠 Initializing Agent Runtime...');

        // Initialize LLM
        try {
            this.llm = new LLMClient();
        } catch (err) {
            console.error('❌ Failed to initialize LLM:', err.message);
            console.log('💡 Go to http://localhost:3000/setup.html to configure');
            // Don't exit - allow running in demo mode
        }

        // Load system prompt
        await this.loadSystemPrompt();

        // Listen for messages from gateway
        this.gateway.on('message', async (data) => {
            await this.handleMessage(data);
        });

        console.log('✅ Agent Runtime ready');
    }

    async loadSystemPrompt() {
        try {
            // Load SOUL.md
            let soul = '';
            try {
                soul = await fs.readFile(join(projectRoot, 'config/SOUL.md'), 'utf-8');
            } catch (e) {
                soul = '# Business AI Assistant\n\nI am a helpful assistant for this business.';
            }

            // Load AGENTS.md
            let rules = '';
            try {
                rules = await fs.readFile(join(projectRoot, 'config/AGENTS.md'), 'utf-8');
            } catch (e) {
                rules = '';
            }

            // Load business info
            let businessInfo = {};
            try {
                const data = await fs.readFile(join(projectRoot, 'config/business.json'), 'utf-8');
                businessInfo = JSON.parse(data);
            } catch (e) { }

            // Load skills
            let skillInstructions = '';
            if (this.skillsManager) {
                skillInstructions = this.skillsManager.getSkillInstructions();
            }

            this.systemPrompt = `${soul}

## Business Information
- Business Name: ${businessInfo.name || 'Not configured'}
- Business Type: ${businessInfo.type || 'restaurant'}
- Location: ${businessInfo.location?.address || ''}, ${businessInfo.location?.city || ''}
- Hours: ${businessInfo.hours || 'Not configured'}
- Phone: ${businessInfo.contact?.phone || ''}

## Behavior Rules
${rules}

## Important Guidelines
1. You have access to tools to get accurate information - USE THEM
2. Always confirm details before finalizing orders or bookings
3. Keep responses concise and friendly (WhatsApp-friendly)
4. Use emoji appropriately
5. If you need to know something about the business, use the search_knowledge tool
6. Always end with a question to keep the conversation going
7. Remember customer preferences for future interactions
8. Learn from user corrections and teach yourself new patterns

${skillInstructions}

When you need to perform actions, use the available tools.`;
        }

  async handleMessage({ channelName, sessionId, message, metadata, session }) {
            console.log(`💬 [${channelName}] Session ${sessionId}: ${message.substring(0, 50)}...`);

            try {
                // Get conversation history
                const history = this.getConversationHistory(sessionId);

                // Get customer memory if available
                let customerContext = '';
                if (this.memoryStore && metadata?.senderPhone) {
                    const customer = this.memoryStore.getCustomer(metadata.senderPhone);
                    if (customer.name || customer.preferences) {
                        customerContext = `\n\n## Customer Context\n`;
                        if (customer.name) customerContext += `- Name: ${customer.name}\n`;
                        if (customer.preferences) customerContext += `- Preferences: ${JSON.stringify(customer.preferences)}\n`;
                        if (customer.visitCount) customerContext += `- Previous visits: ${customer.visitCount}\n`;
                    }
                }

                // Build messages for LLM
                const messages = [
                    { role: 'system', content: this.systemPrompt + customerContext },
                    ...history,
                    { role: 'user', content: message }
                ];

                // Call LLM with tools
                const response = await this.llm.chat(messages, toolDefinitions);

                // Handle tool calls (ReAct loop)
                let finalResponse = response.content;
                let toolCallCount = 0;

                while (response.toolCalls && toolCallCount < this.maxToolCalls) {
                    // Add assistant's tool calls to history
                    for (const toolCall of response.toolCalls) {
                        const toolName = toolCall.function.name;
                        const toolArgs = JSON.parse(toolCall.function.arguments);

                        console.log(`🔧 Tool call: ${toolName}`, toolArgs);

                        // Execute tool
                        const result = await this.tools.execute(toolName, toolArgs);

                        // Add tool result to messages
                        messages.push({
                            role: 'assistant',
                            content: null,
                            tool_calls: [toolCall]
                        });
                        messages.push({
                            role: 'tool',
                            tool_call_id: toolCall.id || `call_${toolName}`,
                            content: JSON.stringify(result)
                        });
                    }

                    // Get next response from LLM
                    const nextResponse = await this.llm.chat(messages, toolDefinitions);
                    finalResponse = nextResponse.content;
                    response.toolCalls = nextResponse.toolCalls;
                    toolCallCount++;
                }

                // Save to conversation history
                this.saveToHistory(sessionId, message, finalResponse);

                // Learn from conversation (if memory available)
                if (this.memoryStore && metadata?.senderPhone) {
                    await this.memoryStore.learnFromConversation(metadata.senderPhone, [
                        { role: 'user', content: message },
                        { role: 'assistant', content: finalResponse }
                    ]);
                }

                // Send response via gateway
                await this.gateway.sendResponse(channelName, sessionId, finalResponse);

            } catch (err) {
                console.error('❌ Agent error:', err);
                const errorMsg = "I apologize, but I encountered an issue processing your request. Please try again or contact us directly.";
                await this.gateway.sendResponse(channelName, sessionId, errorMsg);
            }
        }

        getConversationHistory(sessionId) {
            const session = this.conversations.get(sessionId);
            if (!session) return [];

            // Return last 10 messages for context
            return session.messages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));
        }

        saveToHistory(sessionId, userMessage, assistantMessage) {
            if (!this.conversations.has(sessionId)) {
                this.conversations.set(sessionId, { messages: [] });
            }

            const session = this.conversations.get(sessionId);
            session.messages.push(
                { role: 'user', content: userMessage, timestamp: Date.now() },
                { role: 'assistant', content: assistantMessage, timestamp: Date.now() }
            );

            // Keep only last 50 messages
            if (session.messages.length > 50) {
                session.messages = session.messages.slice(-50);
            }
        }

  async processAdminMessage(sessionId, message) {
            // Handle admin-triggered messages (from dashboard)
            const session = this.gateway.getSession(sessionId);
            if (session) {
                await this.handleMessage({
                    channelName: 'admin',
                    sessionId,
                    message,
                    metadata: { senderName: 'Admin' },
                    session
                });
            }
        }

  // Reload system prompt (for when config changes)
  async reloadPrompt() {
            await this.loadSystemPrompt();
        }
    }

export default AgentRuntime;
