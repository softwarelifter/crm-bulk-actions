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
            // Implement dead letter queue logic here...deferring it for now...
        }
    }

    private async processBulkAction(message: BulkActionMessage) {
        const { actionId, accountId, actionType, configuration } = message;
        const batchSize = configuration.batchSize || this.DEFAULT_BATCH_SIZE;
        const startTime = Date.now();

        try {
            await this.bulkActionService.updateStatus(actionId, 'processing');
            await this.logActionStart(actionId, accountId);

            let processedCount = 0;
            let failedCount = 0;
            let skippedCount = 0;

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

                await this.bulkActionService.updateProgress(actionId, {
                    processed_records: processedCount,
                    failed_records: failedCount,
                    skipped_records: skippedCount
                });

                await this.logProcessingProgress(
                    actionId,
                    batchNumber,
                    accountId,
                    processedCount,
                    failedCount,
                    skippedCount
                );
            }

            await this.bulkActionService.updateStatus(actionId, 'completed');
            await this.logActionCompletion(actionId, accountId, startTime, {
                processed: processedCount,
                failed: failedCount,
                skipped: skippedCount
            });
        } catch (error) {
            await this.bulkActionService.updateStatus(actionId, 'failed');
            await this.logActionError(actionId, accountId, error, startTime);
            throw error;
        }
    }

    private async processBatch(
        actionId: number,
        batchNumber: number,
        batchSize: number,
        message: BulkActionMessage
    ): Promise<{ processed: number; failed: number; skipped: number }> {
        const { configuration, accountId } = message;
        const batch = await this.bulkActionService.createBatch(actionId, batchNumber);
        const batchStartTime = Date.now();

        try {
            const contacts = await this.contactService.getBatch(
                batchNumber * batchSize,
                batchSize,
                configuration.filters
            );

            let processed = 0;
            let failed = 0;
            let skipped = 0;

            for (const contact of contacts) {
                const contactStartTime = Date.now();
                try {
                    if (configuration.updates.email) {
                        const existingContact = await this.contactService.findByEmail(
                            configuration.updates.email
                        );
                        if (existingContact && existingContact.id !== contact.id) {
                            skipped++;
                            await this.logEntitySkipped(
                                actionId,
                                batch.id,
                                contact.id,
                                accountId,
                                'Duplicate email address'
                            );
                            continue;
                        }
                    }

                    await this.retryService.retry(
                        async () => {
                            await this.contactService.update(contact.id, configuration.updates);
                        },
                        {
                            bulkActionId: actionId,
                            batchId: batch.id,
                            entityId: contact.id,
                            accountId: accountId
                        }
                    );

                    processed++;
                    await this.logEntitySuccess(
                        actionId,
                        batch.id,
                        contact.id,
                        accountId,
                        contactStartTime
                    );

                    if (processed % 100 === 0) {
                        await this.logProcessingProgress(
                            actionId,
                            batch.id,
                            accountId,
                            processed,
                            failed,
                            skipped
                        );
                    }
                } catch (error) {
                    failed++;
                    await this.logEntityError(
                        actionId,
                        batch.id,
                        contact.id,
                        accountId,
                        error,
                        contactStartTime
                    );
                }
            }

            await this.logProcessingProgress(
                actionId,
                batch.id,
                accountId,
                processed,
                failed,
                skipped
            );

            await this.logBatchCompletion(
                actionId,
                batch.id,
                accountId,
                batchStartTime,
                { processed, failed, skipped }
            );

            await this.bulkActionService.updateBatchStatus(
                batch.id,
                failed === contacts.length ? 'failed' : 'completed'
            );

            return { processed, failed, skipped };
        } catch (error) {
            await this.bulkActionService.updateBatchStatus(batch.id, 'failed');
            await this.logBatchError(actionId, batch.id, accountId, error, batchStartTime);
            throw error;
        }
    }

    private async logActionStart(actionId: number, accountId: number) {
        await this.logger.log({
            bulk_action_id: actionId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'started',
            level: LogLevel.INFO,
            message: `Bulk action started`,
            processing_time_ms: 0,
            retry_count: 0
        });
    }

    private async logActionCompletion(
        actionId: number,
        accountId: number,
        startTime: number,
        stats: { processed: number; failed: number; skipped: number }
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'completed',
            level: LogLevel.INFO,
            message: `Bulk action completed successfully`,
            processing_time_ms: Date.now() - startTime,
            metadata: stats,
            retry_count: 0
        });
    }

    private async logActionError(
        actionId: number,
        accountId: number,
        error: any,
        startTime: number
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'failed',
            level: LogLevel.ERROR,
            message: `Bulk action failed: ${error.message}`,
            error_code: error.code || 'UNKNOWN_ERROR',
            error_details: error.message,
            processing_time_ms: Date.now() - startTime,
            retry_count: 0
        });
    }

    private async logBatchCompletion(
        actionId: number,
        batchId: number,
        accountId: number,
        startTime: number,
        stats: { processed: number; failed: number; skipped: number }
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'completed',
            level: LogLevel.INFO,
            message: `Batch completed`,
            processing_time_ms: Date.now() - startTime,
            metadata: stats,
            retry_count: 0
        });
    }

    private async logBatchError(
        actionId: number,
        batchId: number,
        accountId: number,
        error: any,
        startTime: number
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'failed',
            level: LogLevel.ERROR,
            message: `Batch failed: ${error.message}`,
            error_code: error.code || 'UNKNOWN_ERROR',
            error_details: error.message,
            processing_time_ms: Date.now() - startTime,
            retry_count: 0
        });
    }

    private async logEntitySuccess(
        actionId: number,
        batchId: number,
        entityId: number,
        accountId: number,
        startTime: number
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            entity_id: entityId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'success',
            level: LogLevel.INFO,
            message: `Successfully processed entity ${entityId}`,
            processing_time_ms: Date.now() - startTime,
            retry_count: 0
        });
    }

    private async logEntityError(
        actionId: number,
        batchId: number,
        entityId: number,
        accountId: number,
        error: any,
        startTime: number
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            entity_id: entityId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'failed',
            level: LogLevel.ERROR,
            message: `Failed to process entity ${entityId}`,
            error_code: error.code || 'UNKNOWN_ERROR',
            error_details: error.message,
            processing_time_ms: Date.now() - startTime,
            retry_count: 0
        });
    }

    private async logEntitySkipped(
        actionId: number,
        batchId: number,
        entityId: number,
        accountId: number,
        reason: string
    ) {
        await this.logger.log({
            bulk_action_id: actionId,
            batch_id: batchId,
            entity_id: entityId,
            account_id: accountId,
            operation_type: OperationType.BULK_UPDATE,
            status: 'skipped',
            level: LogLevel.INFO,
            message: `Skipped entity ${entityId}: ${reason}`,
            metadata: { skip_reason: reason },
            processing_time_ms: 0,
            retry_count: 0
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