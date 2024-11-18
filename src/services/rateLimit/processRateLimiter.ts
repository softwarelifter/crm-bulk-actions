import Redis from "redis"
import { promisify } from "util"

export class ProcessRateLimiter {
    private redis: RedisClient
    private readonly RATE_LIMIT = 10000
    private readonly WINDOW = 60

    constructor() {
        this.redis = Redis.createClient(process.env.REDIS_URL)
    }

    async checkProcessingLimit(accountId: string): Promise<boolean> {
        const key = `rateLimit:process:${accountId}`
        const incrAsync = promisify(this.redis.incr).bind(this.redis)
        const expireAsync = promisify(this.redis.expire).bind(this.redis)

        const current = await incrAsync(key)
        if (current === 1) {
            await expireAsync(key, this.WINDOW)
        }
        return current <= this.RATE_LIMIT

    }
}