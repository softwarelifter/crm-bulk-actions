import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JWTPayload {
    userId: number;
    accountId: number;
}

export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;

        // Type-safe assignment since the interfaces match
        req.user = {
            // userId: decoded.userId,
            accountId: decoded.accountId
        };

        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};