import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

export class ApiRateLimiter {
    private redis: RedisClientType;

    constructor() {
        this.redis = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        // Handle Redis connection events
        this.redis.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.redis.on('connect', () => {
            console.log('Redis Client Connected');
        });

        // Connect to Redis
        this.connect();
    }

    private async connect() {
        try {
            await this.redis.connect();
        } catch (error) {
            console.error('Failed to connect to Redis:', error);
        }
    }

    async checkRateLimit(accountId: string): Promise<boolean> {
        try {
            const key = `ratelimit:api:${accountId}`;
            const limit = 10000;
            const timeWindow = 60;

            const current = await this.redis.incr(key);

            if (current === 1) {
                await this.redis.expire(key, timeWindow);
            }

            return current <= limit;
        } catch (error) {
            console.error('Rate limit check failed:', error);
            // In case of Redis failure, you might want to:
            // 1. Either allow the request (return true)
            // 2. Or deny the request (return false)
            // Depending on your requirements
            return false; // Being conservative here
        }
    }

    // Add a cleanup method to close the Redis connection
    async cleanup() {
        try {
            await this.redis.quit();
        } catch (error) {
            console.error('Failed to close Redis connection:', error);
        }
    }
}