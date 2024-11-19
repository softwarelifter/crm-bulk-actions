import { Consumer, EachMessagePayload } from "kafkajs"
import { kafka } from "../../config/kafka.js"
import { BulkActionService } from "./bulkActionService.js"
import { ContactService } from "../contact/contactService.js"
import { RetryService } from "./retryService.js"
import { ProcessRateLimiter } from "../rateLimit/processRateLimiter.js"
import { LoggerService, LogLevel, OperationType } from "../logging/loggingService.js"

interface BulkActionMessage {
    actionId: number
    accountId: number
    actionType: string
    configuration: {
        updates: Record<string, any>,
        filters?: Record<string, any>,
        batchSize?: number
    }
}

export class KafkaConsumerService {
    private consumer: Consumer
    private bulkActionService: BulkActionService
    private contactService: ContactService
    private retryService: RetryService
    private rateLimiter: ProcessRateLimiter
    private logger: LoggerService

    private readonly DEFAULT_BATCH_SIZE = 1000

    constructor() {
        this.consumer = kafka.consumer({ groupId: 'bulk-action-processor' });
        this.bulkActionService = new BulkActionService();
        this.contactService = new ContactService();
        this.retryService = new RetryService();
        this.rateLimiter = new ProcessRateLimiter();
        this.logger = LoggerService.getInstance();
    }

    async start() {
        await this.consumer.connect();
        await this.consumer.subscribe({ topic: 'bulk-actions', fromBeginning: true });

        await this.consumer.run({
            eachMessage: async (payload) => {
                await this.processMessage(payload);
            },
        });
    }

    private async processMessage({ topic, partition, message }: EachMessagePayload) {
        try {
            const messageData: BulkActionMessage = JSON.parse(message.value?.toString() || '');
            const canProcess = await this.rateLimiter.checkProcessingLimit(
                messageData.accountId.toString()
            );

            if (!canProcess) {
                throw new Error('Rate limit exceeded');
            }

            await this.processBulkAction(messageData);
        } catch (error) {
            console.error('Error processing message:', error);
            // Implement dead letter queue logic here if needed
        }
    }

    private async processBulkAction(message: BulkActionMessage) {
        const { actionId, accountId, actionType, configuration } = message;
        const batchSize = configuration.batchSize || this.DEFAULT_BATCH_SIZE;

        try {
            // Update action status to processing
            await this.bulkActionService.updateStatus(actionId, 'processing');

            let processedCount = 0;
            let failedCount = 0;
            let skippedCount = 0;

            // Get total count for pagination
            const totalContacts = await this.contactService.getTotalCount(configuration.filters);
            const totalBatches = Math.ceil(totalContacts / batchSize);

            for (let batchNumber = 0; batchNumber < totalBatches; batchNumber++) {
                const batchResult = await this.processBatch(
                    actionId,
                    batchNumber,
                    batchSize,
                    message
                );

                processedCount += batchResult.processed;
                failedCount += batchResult.failed;
                skippedCount += batchResult.skipped;

                // Update progress
                await this.bulkActionService.updateProgress(actionId, {
                    processed_records: processedCount,
                    failed_records: failedCount,
                    skipped_records: skippedCount
                });
            }

            // Mark action as completed
            await this.bulkActionService.updateStatus(actionId, 'completed');
        } catch (error) {
            await this.bulkActionService.updateStatus(actionId, 'failed');
            throw error;
        }
    }
    private async processBatch(
        actionId: number,
        batchNumber: number,
        batchSize: number,
        message: BulkActionMessage
    ): Promise<{ processed: number; failed: number; skipped: number }> {
        const { configuration } = message;

        // Create batch record
        const batch = await this.bulkActionService.createBatch(actionId, batchNumber);

        try {
            // Get contacts for this batch
            const contacts = await this.contactService.getBatch(
                batchNumber * batchSize,
                batchSize,
                configuration.filters
            );

            let processed = 0;
            let failed = 0;
            let skipped = 0;

            // Process each contact in the batch
            for (const contact of contacts) {
                try {
                    // Check for duplicates if updating email
                    if (configuration.updates.email) {
                        const existingContact = await this.contactService.findByEmail(
                            configuration.updates.email
                        );
                        if (existingContact && existingContact.id !== contact.id) {
                            skipped++;
                            continue;
                        }
                    }

                    // Attempt to update the contact with retry
                    await this.retryService.retry(
                        async () => {
                            await this.contactService.update(contact.id, configuration.updates);
                        },
                        { bulkActionId: actionId, batchId: batch.id }
                    );

                    processed++;
                } catch (error) {
                    failed++;
                    // Log error details to ClickHouse
                    await this.logError(actionId, batch.id, contact.id, error);
                }
            }

            // Update batch status
            await this.bulkActionService.updateBatchStatus(
                batch.id,
                failed === contacts.length ? 'failed' : 'completed'
            );

            return { processed, failed, skipped };
        } catch (error) {
            await this.bulkActionService.updateBatchStatus(batch.id, 'failed');
            throw error;
        }
    }
    private async logError(
        actionId: number,
        batchId: number,
        contactId: number,
        error: any
    ) {
        const errorCode = error.code || 'UNKNOWN_ERROR';
        const errorDetails = error.message || 'Unknown error occurred';

        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            entity_id: contactId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'failed',
            level: LogLevel.ERROR,
            message: `Failed to process contact ${contactId}`,
            error_code: errorCode,
            error_details: errorDetails,
            processing_time_ms: 0, // You can add actual processing time measurement
            retry_count: 0,
            account_id: 0 // Add actual account ID from context
        });
    }


    private async logProcessingProgress(
        actionId: number,
        batchId: number,
        accountId: number,
        processed: number,
        failed: number,
        skipped: number
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'progress',
            level: LogLevel.INFO,
            message: `Batch progress: ${processed} processed, ${failed} failed, ${skipped} skipped`,
            metadata: { processed, failed, skipped },
            processing_time_ms: 0,
            retry_count: 0
        });
    }

    async stop() {
        await this.consumer.disconnect();
    }
}
