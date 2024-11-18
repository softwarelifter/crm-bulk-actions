import dotenv from 'dotenv';
import pkg from 'pg';
const { Pool } = pkg;
dotenv.config();
console.log("bsdjhksh", process.env.DB_NAME,)


export const pgPool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || "5432"),
});

// Add event listeners for pool errors
pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Optional: Add connection testing
pgPool.query('SELECT NOW()', (err) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connected successfully');
    }
});

export default pgPool;