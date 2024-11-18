import { RedisService } from "../../config/redis.js";
import jwt from "jsonwebtoken"

export class JWTService {
    private redis: RedisService;
    private readonly JWT_SECRET: string;
    private readonly ACCESS_TOKEN_EXPIRY: string = '1d';
    private readonly REFRESH_TOKEN_EXPIRY: string = '7d';

    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        this.redis = RedisService.getInstance();
    }

    async generateTokens(userId: number, accountId: number) {
        const accessToken = jwt.sign(
            { userId, accountId },
            this.JWT_SECRET,
            { expiresIn: this.ACCESS_TOKEN_EXPIRY }
        );

        const refreshToken = jwt.sign(
            { userId, accountId, type: 'refresh' },
            this.JWT_SECRET,
            { expiresIn: this.REFRESH_TOKEN_EXPIRY }
        );

        // Store refresh token
        await this.redis.storeToken(
            refreshToken,
            { userId, accountId },
            7 * 24 * 60 * 60 // 7 days
        );

        return { accessToken, refreshToken };
    }

    async refreshTokens(refreshToken: string) {
        try {
            const decoded = jwt.verify(refreshToken, this.JWT_SECRET) as {
                userId: number;
                accountId: number;
            };

            const storedToken = await this.redis.getToken(refreshToken);
            if (!storedToken) {
                throw new Error('Invalid refresh token');
            }

            const tokens = await this.generateTokens(decoded.userId, decoded.accountId);
            await this.redis.removeToken(refreshToken);

            return tokens;
        } catch (error) {
            throw new Error('Invalid refresh token');
        }
    }

    async revokeToken(refreshToken: string): Promise<void> {
        await this.redis.removeToken(refreshToken);
    }
}