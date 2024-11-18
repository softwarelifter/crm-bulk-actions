import { RedisService } from "../../config/redis.js";

export class ProcessRateLimiter {
    private redis: RedisService;
    private readonly RATE_LIMIT = 10000;
    private readonly WINDOW = 60;

    constructor() {
        this.redis = RedisService.getInstance();
    }

    async checkProcessingLimit(accountId: string): Promise<boolean> {
        const key = `rate_limit:process:${accountId}`;
        return this.redis.checkRateLimit(key, this.RATE_LIMIT, this.WINDOW);
    }
}