// src/workers/bulkActionConsumer.ts
import { KafkaConsumerService } from '../services/bulk/kafkaConsumer.js';

async function startConsumer() {
    const consumer = new KafkaConsumerService();

    process.on('SIGTERM', async () => {
        console.log('Received SIGTERM. Gracefully shutting down...');
        await consumer.stop();
        process.exit(0);
    });

    process.on('SIGINT', async () => {
        console.log('Received SIGINT. Gracefully shutting down...');
        await consumer.stop();
        process.exit(0);
    });

    try {
        await consumer.start();
        console.log('Bulk action consumer started successfully');
    } catch (error) {
        console.error('Failed to start consumer:', error);
        process.exit(1);
    }
}

startConsumer().catch(console.error);