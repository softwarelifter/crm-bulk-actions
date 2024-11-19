import { LoggerService, LogLevel, OperationType } from "../logging/loggingService.js"

interface RetryContext {
    bulkActionId: number;
    batchId: number;
    entityId?: number;
    accountId: number;
}

export class RetryService {
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 1000;
    private logger: LoggerService;

    constructor() {
        this.logger = LoggerService.getInstance();
    }

    async retry<T>(
        operation: () => Promise<T>,
        context: RetryContext
    ): Promise<T> {
        let lastError: Error | null = null;
        const startTime = Date.now();

        for (let attempt = 0; attempt <= RetryService.MAX_RETRIES; attempt++) {
            try {
                if (attempt > 0) {
                    // Log retry attempt
                    await this.logRetryAttempt(context, attempt, startTime);
                    await new Promise(resolve => setTimeout(resolve, RetryService.RETRY_DELAY));
                }

                const result = await operation();

                if (attempt > 0) {
                    // Log successful retry
                    await this.logRetrySuccess(context, attempt, startTime);
                }

                return result;

            } catch (error) {
                lastError = error as Error;

                if (attempt < RetryService.MAX_RETRIES) {
                    // Log retry failure but will try again
                    await this.logRetryFailure(context, attempt, error as Error, startTime, false);
                } else {
                    // Log final retry failure
                    await this.logRetryFailure(context, attempt, error as Error, startTime, true);
                }
            }
        }

        // Log max retries exceeded
        await this.logMaxRetriesExceeded(context, lastError!, startTime);
        throw lastError;
    }

    private async logRetryAttempt(
        context: RetryContext,
        attempt: number,
        startTime: number
    ) {
        try {
            await this.logger.log({
                bulk_action_id: context.bulkActionId,
                batch_id: context.batchId,
                entity_id: context.entityId,
                account_id: context.accountId,
                operation_type: OperationType.RETRY,
                status: 'attempting',
                level: LogLevel.INFO,
                message: `Retry attempt ${attempt} of ${RetryService.MAX_RETRIES}`,
                metadata: {
                    attempt_number: attempt,
                    max_retries: RetryService.MAX_RETRIES,
                    retry_delay_ms: RetryService.RETRY_DELAY
                },
                processing_time_ms: Date.now() - startTime,
                retry_count: attempt
            });
        } catch (error) {
            console.error('Failed to log retry attempt:', error);
        }
    }

    private async logRetrySuccess(
        context: RetryContext,
        attempt: number,
        startTime: number
    ) {
        try {
            await this.logger.log({
                bulk_action_id: context.bulkActionId,
                batch_id: context.batchId,
                entity_id: context.entityId,
                account_id: context.accountId,
                operation_type: OperationType.RETRY,
                status: 'success',
                level: LogLevel.INFO,
                message: `Operation succeeded after ${attempt} ${attempt === 1 ? 'retry' : 'retries'}`,
                metadata: {
                    total_attempts: attempt + 1,
                    successful_attempt: attempt + 1
                },
                processing_time_ms: Date.now() - startTime,
                retry_count: attempt
            });
        } catch (error) {
            console.error('Failed to log retry success:', error);
        }
    }

    private async logRetryFailure(
        context: RetryContext,
        attempt: number,
        error: Error,
        startTime: number,
        isFinal: boolean
    ) {
        try {
            await this.logger.log({
                bulk_action_id: context.bulkActionId,
                batch_id: context.batchId,
                entity_id: context.entityId,
                account_id: context.accountId,
                operation_type: OperationType.RETRY,
                status: isFinal ? 'failed' : 'retrying',
                level: isFinal ? LogLevel.ERROR : LogLevel.WARNING,
                message: isFinal
                    ? `Operation failed after ${attempt + 1} attempts`
                    : `Attempt ${attempt + 1} failed, will retry`,
                error_code: (error as any).code || 'UNKNOWN_ERROR',
                error_details: error.message,
                metadata: {
                    attempt_number: attempt + 1,
                    will_retry: !isFinal,
                    error_name: error.name,
                    error_stack: error.stack
                },
                processing_time_ms: Date.now() - startTime,
                retry_count: attempt
            });
        } catch (error) {
            console.error('Failed to log retry failure:', error);
        }
    }

    private async logMaxRetriesExceeded(
        context: RetryContext,
        error: Error,
        startTime: number
    ) {
        try {
            await this.logger.log({
                bulk_action_id: context.bulkActionId,
                batch_id: context.batchId,
                entity_id: context.entityId,
                account_id: context.accountId,
                operation_type: OperationType.RETRY,
                status: 'max_retries_exceeded',
                level: LogLevel.ERROR,
                message: `Maximum retries (${RetryService.MAX_RETRIES}) exceeded`,
                error_code: (error as any).code || 'MAX_RETRIES_EXCEEDED',
                error_details: error.message,
                metadata: {
                    max_retries: RetryService.MAX_RETRIES,
                    total_duration_ms: Date.now() - startTime,
                    error_name: error.name,
                    error_stack: error.stack
                },
                processing_time_ms: Date.now() - startTime,
                retry_count: RetryService.MAX_RETRIES
            });
        } catch (error) {
            console.error('Failed to log max retries exceeded:', error);
        }
    }
}