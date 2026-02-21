import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

/**
 * Skills Management System
 * - Create, import, export, share skills
 * - Auto-learn skills from patterns
 * - Skill categories
 */
class SkillsManager {
    constructor() {
        this.skills = new Map();
        this.categories = ['core', 'custom', 'learned', 'community'];
    }

    async initialize() {
        console.log('⚡ Initializing Skills Manager...');
        await this.loadAllSkills();
        console.log(`✅ Loaded ${this.skills.size} skills`);
    }

    async loadAllSkills() {
        const skillsDir = join(projectRoot, 'skills');

        try {
            const dirs = await fs.readdir(skillsDir);

            for (const dir of dirs) {
                try {
                    const skillPath = join(skillsDir, dir, 'SKILL.md');
                    const content = await fs.readFile(skillPath, 'utf-8');

                    const skill = this.parseSkillFile(dir, content);
                    this.skills.set(dir, skill);
                } catch (err) {
                    // Directory might not have SKILL.md
                }
            }
        } catch (err) {
            console.log('📁 Skills directory not found, creating...');
            await fs.mkdir(skillsDir, { recursive: true });
        }
    }

    parseSkillFile(name, content) {
        // Parse SKILL.md format
        const lines = content.split('\n');

        let triggers = [];
        let flow = [];
        let examples = [];
        let important = [];
        let currentSection = '';

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith('## ')) {
                currentSection = trimmed.substring(3).toLowerCase();
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                const text = trimmed.substring(2);

                if (currentSection === 'triggers') {
                    triggers.push(text);
                } else if (currentSection === 'flow') {
                    flow.push(text);
                } else if (currentSection === 'examples') {
                    examples.push(text);
                } else if (currentSection === 'important') {
                    important.push(text);
                }
            }
        }

        return {
            name,
            content,
            triggers,
            flow,
            examples,
            important,
            category: name.includes('auto-generated') ? 'learned' : 'custom',
            createdAt: new Date().toISOString(),
            loadedAt: new Date().toISOString()
        };
    }

    // Create a new skill
    async createSkill(name, content) {
        const safeName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        const skillDir = join(projectRoot, 'skills', safeName);

        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(join(skillDir, 'SKILL.md'), content);

        const skill = this.parseSkillFile(safeName, content);
        this.skills.set(safeName, skill);

        return skill;
    }

    // Update existing skill
    async updateSkill(name, content) {
        const skillDir = join(projectRoot, 'skills', name);
        await fs.writeFile(join(skillDir, 'SKILL.md'), content);

        const skill = this.parseSkillFile(name, content);
        skill.updatedAt = new Date().toISOString();
        this.skills.set(name, skill);

        return skill;
    }

    // Delete skill
    async deleteSkill(name) {
        const skillDir = join(projectRoot, 'skills', name);
        await fs.rm(skillDir, { recursive: true, force: true });
        this.skills.delete(name);
    }

    // Get skill by name
    getSkill(name) {
        return this.skills.get(name);
    }

    // Get all skills
    getAllSkills() {
        return Array.from(this.skills.values());
    }

    // Get skills by category
    getSkillsByCategory(category) {
        return this.getAllSkills().filter(s => s.category === category);
    }

    // Search skills
    searchSkills(query) {
        const q = query.toLowerCase();
        return this.getAllSkills().filter(skill => {
            return skill.name.toLowerCase().includes(q) ||
                skill.content.toLowerCase().includes(q) ||
                skill.triggers.some(t => t.toLowerCase().includes(q));
        });
    }

    // Auto-create skill from patterns
    async autoLearnSkill(trigger, response, category = 'learned') {
        const name = `auto-${Date.now()}`;
        const content = `# Auto-Learned Skill

## Triggers
- ${trigger}

## Flow
1. When customer triggers this skill
2. Respond with learned response

## Examples
- Trigger: "${trigger}"
- Response: "${response}"

## Important
- Auto-generated from user corrections
`;

        return await this.createSkill(`auto-generated/${name}`, content);
    }

    // Import skill from JSON
    async importSkill(jsonData) {
        try {
            const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;

            const content = `# ${data.name}

${data.description || ''}

## Triggers
${(data.triggers || []).map(t => `- ${t}`).join('\n')}

## Flow
${(data.flow || []).map(f => `- ${f}`).join('\n')}

## Examples
${(data.examples || []).map(e => `- ${e}`).join('\n')}

## Important
${(data.important || []).map(i => `- ${i}`).join('\n')}

---
*Imported skill*
`;

            return await this.createSkill(data.name, content);
        } catch (error) {
            throw new Error('Invalid skill format: ' + error.message);
        }
    }

    // Export skill to JSON
    exportSkill(name) {
        const skill = this.skills.get(name);
        if (!skill) return null;

        return {
            name: skill.name,
            description: skill.content.substring(0, 200),
            triggers: skill.triggers,
            flow: skill.flow,
            examples: skill.examples,
            important: skill.important,
            category: skill.category,
            exportedAt: new Date().toISOString()
        };
    }

    // Export all skills
    exportAllSkills() {
        return this.getAllSkills().map(skill => this.exportSkill(skill.name));
    }

    // Get skill instructions for agent
    getSkillInstructions() {
        const skills = this.getAllSkills();

        let instructions = '\n\n## AVAILABLE SKILLS\n';

        for (const skill of skills) {
            instructions += `\n### ${skill.name}\n`;
            instructions += `Triggers: ${skill.triggers.join(', ') || 'None'}\n`;
            instructions += `When triggered: ${skill.flow.join(' → ') || 'N/A'}\n`;
        }

        return instructions;
    }
}

export default SkillsManager;
