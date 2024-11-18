import { Request, Response, NextFunction } from 'express'
import { ApiRateLimiter } from '../services/rateLimit/apiRateLimiter.js'
const apiRateLimiter = new ApiRateLimiter()


export const rateLimiterMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const accountId = req.user?.accountId
        if (!accountId) {
            return res.status(401).json({ error: "No accountId Found!" })
        }
        const allowed = await apiRateLimiter.checkRateLimit(accountId.toString())
        if (!allowed) {
            return res.status(429).json({ error: "Rate limit exceeded" })
        }
        next()
    } catch (err) {
        next(err)
    }
}