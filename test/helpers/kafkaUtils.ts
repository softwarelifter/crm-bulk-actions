// test/helpers/kafkaTestUtils.ts
import { EachMessagePayload } from 'kafkajs';

export const createMockEachMessagePayload = (data: any): EachMessagePayload => ({
    topic: 'bulk-actions',
    partition: 0,
    message: {
        key: Buffer.from(String(data.actionId)),
        value: Buffer.from(JSON.stringify(data)),
        timestamp: Date.now().toString(),
        size: 0,
        attributes: 0,
        offset: '0'
    },
    heartbeat: async () => { },
    pause: () => () => { },
});

export const createMockBulkActionMessage = (overrides = {}) => ({
    actionId: 1,
    accountId: 1,
    actionType: 'UPDATE',
    configuration: {
        updates: { status: 'active' },
        filters: { status: 'inactive' },
        batchSize: 100
    },
    ...overrides
});