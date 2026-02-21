import CryptoJS from 'crypto-js';
import { createHash, randomBytes } from 'crypto';

// Generate secure encryption key from environment
const getEncryptionKey = () => {
    const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET || 'restaurant-concierge-default-secret-change-me';
    return createHash('sha256').update(secret).digest();
};

const ENCRYPTION_KEY = getEncryptionKey();

// AES-256-GCM encryption (more secure)
export function encrypt(plaintext) {
    try {
        if (!plaintext) return '';
        const encrypted = CryptoJS.AES.encrypt(plaintext, ENCRYPTION_KEY, {
            mode: CryptoJS.mode.GCM,
            padding: CryptoJS.pad.Pkcs7
        });
        return encrypted.toString();
    } catch (error) {
        console.error('Encryption error:', error.message);
        return null;
    }
}

// AES-256-GCM decryption
export function decrypt(ciphertext) {
    try {
        if (!ciphertext) return '';
        const decrypted = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY, {
            mode: CryptoJS.mode.GCM,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Decryption error:', error.message);
        return null;
    }
}

// Hash for one-way storage (passwords, etc.)
export function hash(text) {
    return CryptoJS.SHA256(text + (process.env.HASH_SALT || 'restaurant-salt')).toString();
}

// Secure random token generation
export function generateToken(length = 32) {
    return randomBytes(length).toString('hex');
}

// API Key masking (for display)
export function maskApiKey(key) {
    if (!key || key.length < 8) return '****';
    return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

// Security audit logging
const securityLog = [];

export function logSecurityEvent(event) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        ip: 'local' // In production, get from request
    };
    securityLog.push(logEntry);

    // Keep only last 1000 events
    if (securityLog.length > 1000) {
        securityLog.shift();
    }

    // Also log to file
    console.log('🔒 Security:', JSON.stringify(logEntry));
}

export function getSecurityLog() {
    return [...securityLog];
}

// Data sanitization (prevent prompt injection)
export function sanitizeInput(input) {
    if (typeof input !== 'string') return '';

    // Remove potential prompt injection patterns
    const dangerous = [
        /ignore.*previous.*instructions/i,
        /system.*prompt/i,
        /you.*are.*now/i,
        /#.*instruction/i,
        /```system/i,
        /<script>/i,
        /javascript:/i,
        /on\w+=/i
    ];

    let sanitized = input;
    for (const pattern of dangerous) {
        sanitized = sanitized.replace(pattern, '[FILTERED]');
    }

    return sanitized;
}

// Rate limiting
const rateLimits = new Map();

export function checkRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
    const now = Date.now();
    const key = identifier;

    if (!rateLimits.has(key)) {
        rateLimits.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    const limit = rateLimits.get(key);

    if (now > limit.resetTime) {
        limit.count = 1;
        limit.resetTime = now + windowMs;
        return true;
    }

    if (limit.count >= maxRequests) {
        logSecurityEvent({ type: 'rate_limit_exceeded', identifier: key });
        return false;
    }

    limit.count++;
    return true;
}

// Export security log
export function exportSecurityLog() {
    return securityLog.map(e => `${e.timestamp} - ${e.event.type || 'event'}: ${JSON.stringify(e.event)}`).join('\n');
}
