// src/services/redis/redisService.ts
import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export class RedisService {
    private static instance: RedisService;
    private client: RedisClientType;
    private initialized: boolean = false;

    private constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        this.client.on('error', (error) => {
            console.error('Redis Error:', error);
        });

        this.client.on('connect', () => {
            console.log('Redis connected');
        });
    }

    public static getInstance(): RedisService {
        if (!RedisService.instance) {
            RedisService.instance = new RedisService();
        }
        return RedisService.instance;
    }

    public async connect(): Promise<void> {
        if (!this.initialized) {
            await this.client.connect();
            this.initialized = true;
        }
    }

    public getClient(): RedisClientType {
        return this.client;
    }

    // Rate limiting methods
    async checkRateLimit(key: string, limit: number, window: number): Promise<boolean> {
        await this.connect();
        const multi = this.client.multi();

        const current = await this.client.incr(key);
        if (current === 1) {
            await this.client.expire(key, window);
        }

        return current <= limit;
    }

    // Token management methods
    async storeToken(token: string, data: any, expirySeconds: number): Promise<void> {
        await this.connect();
        await this.client.setEx(
            `token:${token}`,
            expirySeconds,
            JSON.stringify(data)
        );
    }

    async getToken(token: string): Promise<any> {
        await this.connect();
        const data = await this.client.get(`token:${token}`);
        return data ? JSON.parse(data) : null;
    }

    async removeToken(token: string): Promise<void> {
        await this.connect();
        await this.client.del(`token:${token}`);
    }

    // Cache methods
    async setCached<T>(key: string, data: T, expirySeconds?: number): Promise<void> {
        await this.connect();
        if (expirySeconds) {
            await this.client.setEx(
                key,
                expirySeconds,
                JSON.stringify(data)
            );
        } else {
            await this.client.set(key, JSON.stringify(data));
        }
    }

    async getCached<T>(key: string): Promise<T | null> {
        await this.connect();
        const data = await this.client.get(key);
        return data ? JSON.parse(data) : null;
    }

    async removeCached(key: string): Promise<void> {
        await this.connect();
        await this.client.del(key);
    }

    // Utility methods
    async disconnect(): Promise<void> {
        if (this.initialized) {
            await this.client.quit();
            this.initialized = false;
        }
    }

    // Method to check if Redis is connected
    async isConnected(): Promise<boolean> {
        try {
            await this.client.ping();
            return true;
        } catch {
            return false;
        }
    }

    // Method for cleanup
    async clear(): Promise<void> {
        await this.connect();
        await this.client.flushDb();
    }
}

// Example usage in a service:
// src/services/auth/jwtService.ts
export class JWTService {
    private redis: RedisService;

    constructor() {
        this.redis = RedisService.getInstance();
    }

    async initialize() {
        await this.redis.connect();
    }

    // ... rest of the methods
}