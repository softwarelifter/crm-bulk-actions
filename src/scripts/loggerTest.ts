// src/scripts/testLogger.ts
import { LoggerService, LogLevel, OperationType } from '../services/logging/loggingService.js';

async function testLogger() {
    const logger = LoggerService.getInstance();

    try {
        // Test 1: Basic Info Log
        await logger.log({
            bulk_action_id: 1,
            account_id: 1,
            operation_type: OperationType.BULK_UPDATE,
            status: 'processing',
            level: LogLevel.INFO,
            message: 'Starting bulk operation',
            processing_time_ms: 0,
            retry_count: 0,
            metadata: {
                total_records: 100,
                batch_size: 10
            }
        });

        // Test 2: Error Log
        await logger.log({
            bulk_action_id: 1,
            account_id: 1,
            operation_type: OperationType.BULK_UPDATE,
            status: 'failed',
            level: LogLevel.ERROR,
            message: 'Failed to process batch',
            error_code: 'BATCH_PROCESSING_ERROR',
            error_details: 'Database connection timeout',
            processing_time_ms: 1500,
            retry_count: 1,
            batch_id: 1
        });

        // Wait for logs to be flushed (since flush interval is 5000ms)
        console.log('Waiting for logs to be flushed...');
        await new Promise(resolve => setTimeout(resolve, 6000));

        // Test 3: Retrieve Logs
        console.log('Retrieving logs...');
        const logs = await logger.getBulkActionLogs(1);
        console.log('Retrieved logs:', JSON.stringify(logs, null, 2));

        // Test 4: Get Error Summary
        console.log('Retrieving error summary...');
        const errorSummary = await logger.getErrorSummary(1);
        console.log('Error summary:', JSON.stringify(errorSummary, null, 2));

    } catch (error) {
        console.error('Error in test:', error);
    }
}


// Replace CommonJS check with ESM version
if (import.meta.url === `file://${process.argv[1]}`) {
    testLogger()
        .then(() => {
            console.log('Test completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Test failed:', error);
            process.exit(1);
        });
}

export { testLogger };