import { kafka } from "../../config/kafka.js"
import { pgPool } from "../../config/database.js"
import { RetryService } from "./retryService.js"
import { BulkAction } from "../../models/bulkAction.js"


export class BulkActionService {
    private producer = kafka.producer()
    private retryService = new RetryService()
    private isConnected: boolean = false

    private async ensureConnected() {
        if (!this.isConnected) {
            try {
                await this.producer.connect();
                this.isConnected = true;
                console.log('Successfully connected to Kafka producer');
            } catch (error) {
                console.error('Failed to connect to Kafka:', error);
                throw new Error('Failed to connect to Kafka');
            }
        }
    }

    async initialize() {
        await this.ensureConnected();
    }

    async shutdown() {
        if (this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
        }
    }

    async createBulkAction(
        accountId: number,
        actionType: string,
        configuration: Record<string, any>,
        scheduledFor?: Date
    ): Promise<BulkAction> {
        const result = await pgPool.query(
            `INSERT INTO bulk_actions 
            (account_id, action_type, status, configuration, scheduled_for)  
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
                accountId,
                actionType,
                scheduledFor ? 'scheduled' : 'pending',
                JSON.stringify(configuration),
                scheduledFor || null
            ]
        );

        const bulkAction = result.rows[0]

        if (!scheduledFor) {
            await this.producer.send({
                topic: 'bulk-actions',
                messages: [{
                    key: bulkAction.id.toString(),
                    value: JSON.stringify({
                        actionId: bulkAction.id,
                        accountId,
                        actionType,
                        configuration
                    })
                }]
            })
        }
        return bulkAction
    }

    async list(page: number = 1, limit: number = 10): Promise<{
        bulkActions: BulkAction[],
        total: number,
        page: number,
        totalPages: number
    }> {
        const offset = (page - 1) * limit
        const [countResult, dataResult] = await Promise.all(
            [pgPool.query("SELECT COUNT(*) FROM bulk_actions"),
            pgPool.query("SELECT * FROM bulk_actions ORDER BY created_at DESC LIMIT $1 OFFSET $2", [limit, offset])
            ]
        )
        const total = parseInt(countResult.rows[0].count)
        const totalPages = Math.ceil(total / limit)
        return {
            bulkActions: dataResult.rows,
            total, totalPages, page
        }
    }

    async getBulkAction(id: number): Promise<BulkAction> {
        const result = await pgPool.query(`SELECT * FROM bulk_actions WHERE id = ${id}`)
        return result.rows[0]

    }

    async getBulkActionStats(id: number) {
        const result = await pgPool.query(`SELECT 
            total_records,
            processed_records,
            failed_records,
            skipped_records,
            status
            FROM bulk_actions WHERE id = ${id}`)
        return result.rows[0]
    }

    async updateStatus(id: number, status: string): Promise<void> {
        await pgPool.query(
            `UPDATE bulk_actions 
             SET status = $1::varchar, 
                 updated_at = CURRENT_TIMESTAMP,
                 completed_at = CASE WHEN $1::varchar = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
             WHERE id = $2`,
            [status, id]
        );
    }

    async updateProgress(
        id: number,
        progress: {
            processed_records: number;
            failed_records: number;
            skipped_records: number;
        }
    ): Promise<void> {
        await pgPool.query(
            `UPDATE bulk_actions 
           SET processed_records = $1,
               failed_records = $2,
               skipped_records = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
            [progress.processed_records, progress.failed_records, progress.skipped_records, id]
        );
    }

    async createBatch(actionId: number, batchNumber: number) {
        const result = await pgPool.query(
            `INSERT INTO bulk_action_batches 
           (bulk_action_id, batch_number, status) 
           VALUES ($1, $2, 'processing')
           RETURNING *`,
            [actionId, batchNumber]
        );
        return result.rows[0];
    }

    async updateBatchStatus(batchId: number, status: string): Promise<void> {
        await pgPool.query(
            `UPDATE bulk_action_batches 
           SET status = $1, 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
            [status, batchId]
        );
    }


}