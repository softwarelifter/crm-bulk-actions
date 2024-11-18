import brcypt from "bcrypt"
import jwt from 'jsonwebtoken'
import { pgPool } from "../../config/database.js"
import { User } from "../../models/user.js"


export class AuthService {
    private static readonly SALT_ROUNDS = 10
    async registerUser(email: string, password: string): Promise<User> {
        const password_hash = await brcypt.hash(password, AuthService.SALT_ROUNDS)
        const result = await pgPool.query(`INSERT INTO users (email,password_hash) VALUES (${email}, ${password_hash})`)
        return result.rows[0]
    }

    async validateUser(email: string, password: string): Promise<User | null> {
        const result = await pgPool.query(`SELECT * FROM Users WHERE email=${email}`)
        const user = result.rows[0]
        if (!user) return null
        const isValid = await brcypt.compare(password, user.password_hash)
        return isValid ? user : null
    }
}
