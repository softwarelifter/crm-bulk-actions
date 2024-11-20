// test/setup.ts
import { Pool } from 'pg';
import { RedisService } from '../src/config/redis.js';
import { kafka } from '../src/config/kafka.js';
import { clickHouse } from '../src/config/clickHouse.js';

// Mock external services
jest.mock('pg', () => ({
    Pool: jest.fn(() => ({
        query: jest.fn(),
        connect: jest.fn(),
        on: jest.fn(),
    })),
}));

jest.mock('../src/config/redis', () => ({
    RedisService: {
        getInstance: jest.fn(() => ({
            connect: jest.fn(),
            checkRateLimit: jest.fn(),
            storeToken: jest.fn(),
            getToken: jest.fn(),
            removeToken: jest.fn(),
        })),
    },
}));

jest.mock('../src/config/kafka', () => ({
    kafka: {
        producer: jest.fn(() => ({
            connect: jest.fn(),
            send: jest.fn(),
            disconnect: jest.fn(),
        })),
        consumer: jest.fn(() => ({
            connect: jest.fn(),
            subscribe: jest.fn(),
            run: jest.fn(),
            disconnect: jest.fn(),
        })),
    },
}));

jest.mock('@clickhouse/client', () => ({
    createClient: jest.fn(() => ({
        query: jest.fn(),
        exec: jest.fn(),
        insert: jest.fn(),
    })),
}));

// Clear all mocks after each test
afterEach(() => {
    jest.clearAllMocks();
});

// Suppress console.log during tests
beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => { });
    jest.spyOn(console, 'error').mockImplementation(() => { });
});

afterAll(() => {
    (console.log as jest.Mock).mockRestore();
    (console.error as jest.Mock).mockRestore();
});