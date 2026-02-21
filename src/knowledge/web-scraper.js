import https from 'https';
import http from 'http';

/**
 * Web Scraper / Data Fetcher
 * Allows agent to fetch data from business websites, APIs, and databases
 */
class WebScraper {
    constructor() {
        this.connectedSources = new Map();
        this.cache = new Map();
    }

    // Fetch content from a URL
    async fetch(url, options = {}) {
        const { method = 'GET', headers = {}, body = null, timeout = 10000 } = options;

        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https') ? https : http;

            const req = protocol.request(url, { method, headers, timeout }, (res) => {
                let data = '';

                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: data,
                        contentType: res.headers['content-type']
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => reject(new Error('Request timeout')));

            if (body) req.write(body);
            req.end();
        });
    }

    // Fetch and parse HTML
    async scrapeWebsite(url) {
        try {
            const response = await this.fetch(url);

            if (response.status !== 200) {
                return { error: `HTTP ${response.status}` };
            }

            // Basic HTML parsing
            const html = response.body;

            // Extract title
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const title = titleMatch ? titleMatch[1].trim() : '';

            // Extract meta description
            const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
            const description = descMatch ? descMatch[1].trim() : '';

            // Extract main content (simple approach)
            const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
            const bodyContent = bodyMatch ? bodyMatch[1] : '';

            // Remove scripts and styles
            const cleanContent = bodyContent
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Extract links
            const linkMatches = html.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi);
            const links = linkMatches ? linkMatches.slice(0, 20).map(m => {
                const hrefMatch = m.match(/href=["']([^"']+)["']/);
                const textMatch = m.match(/>([^<]+)</);
                return {
                    url: hrefMatch ? hrefMatch[1] : '',
                    text: textMatch ? textMatch[1].trim() : ''
                };
            }) : [];

            return {
                url,
                title,
                description,
                content: cleanContent.substring(0, 5000), // Limit content
                links,
                scrapedAt: new Date().toISOString()
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Fetch from business API
    async fetchFromAPI(url, apiKey = null) {
        const headers = {
            'Accept': 'application/json',
            'User-Agent': 'Restaurant-Concierge/1.0'
        };

        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        try {
            const response = await this.fetch(url, { headers });

            if (response.status !== 200) {
                return { error: `HTTP ${response.status}` };
            }

            // Try to parse JSON
            try {
                const json = JSON.parse(response.body);
                return { data: json, fetchedAt: new Date().toISOString() };
            } catch {
                return { data: response.body, fetchedAt: new Date().toISOString() };
            }
        } catch (error) {
            return { error: error.message };
        }
    }

    // Connect a data source
    connectSource(name, type, config) {
        this.connectedSources.set(name, {
            type, // 'website', 'api', 'database'
            config,
            connectedAt: new Date().toISOString(),
            status: 'connected'
        });
    }

    // Get connected sources
    getConnectedSources() {
        return Array.from(this.connectedSources.entries()).map(([name, data]) => ({
            name,
            ...data
        }));
    }

    // Disconnect a source
    disconnectSource(name) {
        this.connectedSources.delete(name);
    }

    // Search within scraped content
    searchContent(query, content) {
        const q = query.toLowerCase();
        const c = content.toLowerCase();

        if (c.includes(q)) {
            // Find context around match
            const index = c.indexOf(q);
            const start = Math.max(0, index - 100);
            const end = Math.min(content.length, index + q + 100);

            return {
                found: true,
                context: '...' + content.substring(start, end) + '...',
                position: index
            };
        }

        return { found: false };
    }

    // Smart search across all connected sources
    async smartSearch(query) {
        const results = [];

        for (const [name, source] of this.connectedSources) {
            if (source.type === 'website' && source.config.url) {
                const content = await this.scrapeWebsite(source.config.url);
                if (content.content) {
                    const match = this.searchContent(query, content.content);
                    if (match.found) {
                        results.push({
                            source: name,
                            type: 'website',
                            ...match
                        });
                    }
                }
            }
        }

        return results;
    }
}

export default WebScraper;
