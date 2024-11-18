import dotenv from 'dotenv';
import { Kafka } from "kafkajs"
dotenv.config();

console.log("process.env.KAFKA_BROKERS", process.env.KAFKA_BROKERS)
export const kafka = new Kafka({
    clientId: 'bulk-action-service',
    brokers: (process.env.KAFKA_BROKERS || '').split(','),
})