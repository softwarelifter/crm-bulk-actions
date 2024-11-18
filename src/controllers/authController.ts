import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/auth/authService.js';
import { JWTService } from '../services/auth/jwtService.js';

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().optional()
});

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

export class AuthController {
    private authService: AuthService;
    private jwtService: JWTService;

    constructor() {
        this.authService = new AuthService();
        this.jwtService = new JWTService();
    }

    async register(req: Request, res: Response) {
        try {
            const { email, password } = RegisterSchema.parse(req.body);

            // Check if user already exists
            const existingUser = await this.authService.findByEmail(email);
            if (existingUser) {
                return res.status(409).json({ error: 'User already exists' });
            }

            // Create user
            const user = await this.authService.registerUser(email, password);

            // Create default account for user
            const account = await this.authService.createAccountForUser(user.id, `${email}'s Account`);

            // Generate tokens
            const { accessToken, refreshToken } = await this.jwtService.generateTokens(user.id, account.id);

            res.status(201).json({
                user: {
                    id: user.id,
                    email: user.email,
                },
                account: {
                    id: account.id,
                    name: account.name
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            });
        } catch (error) {
            console.log(error)
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            res.status(500).json({ error: 'Registration failed' });
        }
    }

    async login(req: Request, res: Response) {
        try {
            const { email, password } = LoginSchema.parse(req.body);

            // Validate credentials
            const user = await this.authService.validateUser(email, password);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Get user's primary account
            const account = await this.authService.getPrimaryAccount(user.id);
            if (!account) {
                return res.status(500).json({ error: 'No account found for user' });
            }

            // Generate tokens
            const { accessToken, refreshToken } = await this.jwtService.generateTokens(user.id, account.id);

            res.json({
                user: {
                    id: user.id,
                    email: user.email,
                },
                account: {
                    id: account.id,
                    name: account.name
                },
                tokens: {
                    accessToken,
                    refreshToken
                }
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({ error: error.errors });
            }
            res.status(500).json({ error: 'Login failed' });
        }
    }

    async refreshToken(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                return res.status(400).json({ error: 'Refresh token is required' });
            }

            const tokens = await this.jwtService.refreshTokens(refreshToken);
            res.json(tokens);
        } catch (error) {
            res.status(401).json({ error: 'Invalid refresh token' });
        }
    }

    async logout(req: Request, res: Response) {
        try {
            const refreshToken = req.body.refreshToken;
            if (refreshToken) {
                await this.jwtService.revokeToken(refreshToken);
            }
            res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Logout failed' });
        }
    }
}

