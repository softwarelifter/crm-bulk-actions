import { RedisService } from "../../config/redis.js";

export class ApiRateLimiter {
    private redis: RedisService;
    private readonly RATE_LIMIT = 10000; // 10k requests per minute
    private readonly WINDOW = 60; // 1 minute

    constructor() {
        this.redis = RedisService.getInstance();
    }

    async checkRateLimit(accountId: string): Promise<boolean> {
        const key = `rate_limit:api:${accountId}`;
        return this.redis.checkRateLimit(key, this.RATE_LIMIT, this.WINDOW);
    }
}