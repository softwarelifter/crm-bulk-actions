import { Kafka } from "kafkajs"


export const kafka = new Kafka({
    clientId: 'bulk-action-service',
    brokers: (process.env.KAFKA_BROKERS || '').split(','),
})