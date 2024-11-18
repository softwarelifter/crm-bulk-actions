// src/services/auth/authService.ts
import bcrypt from 'bcrypt';
import { pgPool } from '../../config/database.js';
import { User } from '../../models/user.js';
import { Account } from '../../models/account.js';

export class AuthService {
    private static readonly SALT_ROUNDS = 10;

    async registerUser(
        email: string,
        password: string,
    ): Promise<User> {
        const passwordHash = await bcrypt.hash(password, AuthService.SALT_ROUNDS);

        const result = await pgPool.query(
            `INSERT INTO users (email, password_hash) 
       VALUES ($1, $2) 
       RETURNING id, email, created_at`,
            [email, passwordHash]
        );

        return result.rows[0];
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const result = await pgPool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );

        const user = result.rows[0];
        if (!user) return null;

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return null;

        // Don't return password_hash
        delete user.password_hash;
        return user;
    }

    async findByEmail(email: string): Promise<User | null> {
        const result = await pgPool.query(
            'SELECT id, email,  created_at FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0] || null;
    }

    async createAccountForUser(
        userId: number,
        accountName: string
    ): Promise<Account> {
        // Start a transaction
        const client = await pgPool.connect();
        try {
            await client.query('BEGIN');

            // Create account
            const accountResult = await client.query(
                `INSERT INTO accounts (name) 
         VALUES ($1) 
         RETURNING *`,
                [accountName]
            );
            const account = accountResult.rows[0];

            // Link user to account with admin role
            await client.query(
                `INSERT INTO user_accounts (user_id, account_id, role) 
         VALUES ($1, $2, $3)`,
                [userId, account.id, 'admin']
            );

            await client.query('COMMIT');
            return account;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getPrimaryAccount(userId: number): Promise<Account | null> {
        const result = await pgPool.query(
            `SELECT a.* 
       FROM accounts a
       JOIN user_accounts ua ON ua.account_id = a.id
       WHERE ua.user_id = $1
       ORDER BY a.created_at ASC
       LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    async getUserAccounts(userId: number): Promise<Array<Account & { role: string }>> {
        const result = await pgPool.query(
            `SELECT a.*, ua.role
       FROM accounts a
       JOIN user_accounts ua ON ua.account_id = a.id
       WHERE ua.user_id = $1
       ORDER BY a.created_at ASC`,
            [userId]
        );
        return result.rows;
    }
}