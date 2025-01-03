import dotenv from 'dotenv';
import { createClient } from '@clickhouse/client'
dotenv.config();
console.log("host: process.env.CLICKHOUSE_HOST", process.env.CLICKHOUSE_HOST, process.env.CLICKHOUSE_DATABASE)

export const clickHouse = createClient({
    host: process.env.CLICKHOUSE_HOST || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USER || 'default',
    password: process.env.CLICKHOUSE_PASSWORD || '',
    database: process.env.CLICKHOUSE_DATABASE || 'default'
})