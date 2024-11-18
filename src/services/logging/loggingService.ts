import { clickHouse } from "../../config/clickHouse.js"
import { v4 as uuidv4 } from "uuid"

export enum LogLevel {
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR"
}

export enum OperationType {
    BULK_UPDATE = 'BULK_UPDATE',
    BULK_DELETE = 'BULK_DELETE',
    RETRY = 'RETRY',
    VALIDATION = 'VALIDATION',
    RATE_LIMIT = 'RATE_LIMIT'
}

export interface LogEntry {
    log_id: string;
    timestamp: Date;
    bulk_action_id: number;
    batch_id?: number;
    account_id: number;
    entity_id?: number;
    operation_type: OperationType;
    status: string;
    level: LogLevel;
    message: string;
    error_code?: string;
    error_details?: string;
    metadata?: Record<string, any>;
    processing_time_ms: number;
    retry_count: number;
}

export class LoggerService {
    private static instance: LoggerService
    private batchSize: number = 1000;
    private logQueue: LogEntry[] = [];
    private flushInterval: NodeJS.Timeout;

    constructor() {
        this.flushInterval = setInterval(() => this.flush(), 5000);
    }

    public static getInstance() {
        if (!LoggerService.instance) {
            LoggerService.instance = new LoggerService()
        }
        return LoggerService.instance
    }


    async log(entry: Omit<LogEntry, 'log_id' | 'timestamp'>): Promise<void> {
        const completeEntry = {
            ...entry,
            log_id: uuidv4(),
            timestamp: new Date()
        }

        this.logQueue.push(completeEntry)
        if (this.logQueue.length >= this.batchSize) {
            await this.flush()
        }
    }

    private async flush() {
        if (this.logQueue.length === 0) return

        const entries = [...this.logQueue]
        this.logQueue = []

        try {
            await clickHouse.insert({
                table: 'bulk_action_logs',
                values: entries,
                format: 'JSONEachRow'
            })
        } catch (err) {
            this.logQueue = [...entries, ...this.logQueue]
        }
    }

    async getBulkActionLogs(bulkActionId: number,
        options: {
            startTime?: Date;
            endTime?: Date;
            level?: LogLevel;
            limit?: number;
            offset?: number;
        } = {}): Promise<LogEntry[]> {
        const {
            startTime = new Date(0),
            endTime = new Date(),
            level,
            limit = 100,
            offset = 0
        } = options;

        let query = `
            SELECT *
            FROM bulk_action_logs
            WHERE bulk_action_id = ${bulkActionId}
                AND timestamp BETWEEN toDateTime('${startTime.toISOString()}')
                AND toDateTime('${endTime.toISOString()}')
            `

        if (level) {
            query += ` AND level = '${level}'`;
        }
        query += `
            ORDER BY timestamp DESC
            LIMIT ${limit}
            OFFSET ${offset}
            `;

        const result = await clickHouse.query({
            query,
            format: 'JSONEachRow'
        });

        return result.json()
    }

    async getErrorSummary(bulkActionId: number): Promise<{
        error_code: string;
        count: number;
        latest_occurrence: Date;
    }[]> {
        const query = `
          SELECT
            error_code,
            count() as count,
            max(timestamp) as latest_occurrence
          FROM bulk_action_logs
          WHERE bulk_action_id = ${bulkActionId}
            AND level = 'ERROR'
          GROUP BY error_code
          ORDER BY count DESC
        `;

        const result = await clickHouse.query({
            query,
            format: 'JSONEachRow'
        });

        return result.json();
    }
    async cleanup(retentionDays: number = 30): Promise<void> {
        const query = `
          ALTER TABLE bulk_action_logs
          DELETE WHERE timestamp < now() - INTERVAL ${retentionDays} DAY
        `;

        await clickHouse.exec({
            query
        });
    }
}
