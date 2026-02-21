import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

class RAGSystem {
    constructor() {
        this.vectors = new Map();
        this.documents = [];
    }

    async initialize() {
        console.log('📚 Initializing RAG Knowledge System...');
        await this.ingestBusinessDocs();
        console.log(`✅ Loaded ${this.documents.length} knowledge documents`);
    }

    async ingestBusinessDocs() {
        const businessDir = join(projectRoot, 'data/business');

        try {
            const files = await fs.readdir(businessDir);

            for (const file of files) {
                if (file.endsWith('.md') || file.endsWith('.txt')) {
                    const content = await fs.readFile(join(businessDir, file), 'utf-8');
                    const doc = {
                        id: `doc_${file}`,
                        filename: file,
                        content,
                        chunks: this.chunkContent(content),
                        createdAt: new Date().toISOString()
                    };
                    this.documents.push(doc);
                }
            }
        } catch (err) {
            console.warn('⚠️ No business documents found yet');
        }
    }

    chunkContent(content, chunkSize = 500) {
        // Simple chunking - split by sentences/paragraphs
        const paragraphs = content.split(/\n\n+/);
        const chunks = [];
        let currentChunk = '';

        for (const para of paragraphs) {
            if ((currentChunk + para).length > chunkSize && currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            currentChunk += para + '\n\n';
        }

        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    async search(query, topK = 3) {
        // Simple keyword-based search (no embeddings for now)
        const queryLower = query.toLowerCase();
        const results = [];

        for (const doc of this.documents) {
            for (let i = 0; i < doc.chunks.length; i++) {
                const chunk = doc.chunks[i];
                const chunkLower = chunk.toLowerCase();

                // Calculate simple relevance score
                let score = 0;
                const queryWords = queryLower.split(/\s+/);

                for (const word of queryWords) {
                    if (word.length < 3) continue;
                    if (chunkLower.includes(word)) {
                        score += word.length;
                    }
                }

                if (score > 0) {
                    results.push({
                        docId: doc.id,
                        filename: doc.filename,
                        chunkIndex: i,
                        content: chunk,
                        score
                    });
                }
            }
        }

        // Sort by score and return top K
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, topK);
    }

    async addDocument(filename, content) {
        const doc = {
            id: `doc_${Date.now()}`,
            filename,
            content,
            chunks: this.chunkContent(content),
            createdAt: new Date().toISOString()
        };

        this.documents.push(doc);

        // Save to file
        const businessDir = join(projectRoot, 'data/business');
        await fs.mkdir(businessDir, { recursive: true });
        await fs.writeFile(join(businessDir, filename), content);

        return doc;
    }

    getAllDocuments() {
        return this.documents.map(d => ({
            id: d.id,
            filename: d.filename,
            chunks: d.chunks.length,
            createdAt: d.createdAt
        }));
    }
}

export default RAGSystem;
