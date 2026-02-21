import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';

config();

class LLMClient {
    constructor(options = {}) {
        this.provider = process.env.LLM_PROVIDER || options.provider || 'openrouter';
        this.model = process.env.LLM_MODEL || options.model || 'openrouter/auto';
        this.totalTokensUsed = 0;
        this.totalCost = 0;
        this.client = null;

        this.initializeClient();
    }

    initializeClient() {
        switch (this.provider) {
            case 'openai':
                if (!process.env.OPENAI_API_KEY) {
                    throw new Error('OPENAI_API_KEY is required for OpenAI provider');
                }
                this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                console.log(`✅ LLM: OpenAI / ${this.model}`);
                break;

            case 'anthropic':
                if (!process.env.ANTHROPIC_API_KEY) {
                    throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
                }
                this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
                console.log(`✅ LLM: Anthropic / ${this.model}`);
                break;

            case 'ollama':
                this.client = new OpenAI({
                    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
                    apiKey: 'ollama'
                });
                this.model = this.model || 'llama3.1';
                console.log(`✅ LLM: Ollama / ${this.model}`);
                break;

            case 'openrouter':
            case 'deepseek':
            case 'groq':
                // These all use OpenAI-compatible APIs
                const baseURLs = {
                    openrouter: 'https://openrouter.ai/api/v1',
                    deepseek: 'https://api.deepseek.com/v1',
                    groq: 'https://api.groq.com/openai/v1'
                };

                const apiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.GROQ_API_KEY;
                if (!apiKey) {
                    throw new Error(`API key required for ${this.provider}`);
                }

                this.client = new OpenAI({
                    baseURL: baseURLs[this.provider] || baseURLs.openrouter,
                    apiKey: apiKey
                });

                // For openrouter, default to a free model if none specified
                if (this.provider === 'openrouter' && this.model === 'openrouter/auto') {
                    this.model = 'deepseek/deepseek-r1-0528:free';
                }

                console.log(`✅ LLM: ${this.provider} / ${this.model}`);
                break;

            default:
                throw new Error(`Unknown LLM provider: ${this.provider}`);
        }
    }

    async chat(messages, tools = null) {
        try {
            if (this.provider === 'anthropic') {
                return await this._callAnthropic(messages, tools);
            }
            return await this._callOpenAI(messages, tools);
        } catch (error) {
            console.error(`❌ LLM Error:`, error.message);

            // Try fallback to Ollama if available
            if (this.provider !== 'ollama' && process.env.OLLAMA_BASE_URL) {
                console.log('⚠️ Trying Ollama fallback...');
                try {
                    const fallback = new OpenAI({
                        baseURL: process.env.OLLAMA_BASE_URL + '/v1',
                        apiKey: 'ollama'
                    });
                    const params = {
                        model: 'llama3.1',
                        messages,
                        max_tokens: 4096
                    };
                    if (tools?.length) {
                        params.tools = tools;
                        params.tool_choice = 'auto';
                    }
                    const r = await fallback.chat.completions.create(params);
                    return {
                        content: r.choices[0].message.content || '',
                        toolCalls: r.choices[0].message.tool_calls || null
                    };
                } catch (e) {
                    console.error('❌ Fallback failed:', e.message);
                }
            }

            throw error;
        }
    }

    async _callOpenAI(messages, tools) {
        const params = {
            model: this.model,
            messages,
            max_tokens: 4096
        };

        if (tools?.length) {
            params.tools = tools;
            params.tool_choice = 'auto';
        }

        const response = await this.client.chat.completions.create(params);
        const choice = response.choices[0];

        if (response.usage) {
            this.totalTokensUsed += (response.usage.prompt_tokens || 0) + (response.usage.completion_tokens || 0);
        }

        return {
            content: choice.message.content || '',
            toolCalls: choice.message.tool_calls || null,
            usage: response.usage
        };
    }

    async _callAnthropic(messages, tools) {
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMsgs = messages.filter(m => m.role !== 'system');

        const params = {
            model: this.model,
            max_tokens: 4096,
            system: systemMsg?.content || '',
            messages: chatMsgs.map(m => ({
                role: m.role === 'assistant' ? 'assistant' : 'user',
                content: m.content
            }))
        };

        if (tools?.length) {
            params.tools = tools.map(t => ({
                name: t.function.name,
                description: t.function.description,
                input_schema: t.function.parameters
            }));
        }

        const response = await this.client.messages.create(params);
        const textBlocks = response.content.filter(b => b.type === 'text');
        const toolBlocks = response.content.filter(b => b.type === 'tool_use');

        return {
            content: textBlocks.map(b => b.text).join(''),
            toolCalls: toolBlocks.length > 0 ? toolBlocks.map(b => ({
                id: b.id,
                type: 'function',
                function: {
                    name: b.name,
                    arguments: JSON.stringify(b.input)
                }
            })) : null,
            usage: response.usage
        };
    }

    getStats() {
        return {
            totalTokensUsed: this.totalTokensUsed,
            totalCost: this.totalCost,
            provider: this.provider,
            model: this.model
        };
    }
}

export default LLMClient;
