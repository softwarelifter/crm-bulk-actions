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

// Interface for runtime use
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

// Interface for database storage
interface LogEntryDB {
    log_id: string;
    timestamp: string;
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
    metadata?: string;
    processing_time_ms: number;
    retry_count: number;
}

export class LoggerService {
    private static instance: LoggerService
    private batchSize: number = 1000;
    private logQueue: LogEntryDB[] = [];
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

    private formatDate(date: Date): string {
        return date.toISOString().slice(0, 23).replace('T', ' ');
    }

    async log(entry: Omit<LogEntry, 'log_id' | 'timestamp'>): Promise<void> {
        const dbEntry: LogEntryDB = {
            ...entry,
            log_id: uuidv4(),
            timestamp: this.formatDate(new Date()),
            metadata: entry.metadata ? JSON.stringify(entry.metadata) : undefined
        }

        this.logQueue.push(dbEntry)
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
            console.error("Error in flush:", err)
            this.logQueue = [...entries, ...this.logQueue]
        }
    }

    private convertToLogEntry(dbLog: LogEntryDB): LogEntry {
        return {
            ...dbLog,
            timestamp: new Date(dbLog.timestamp),
            metadata: dbLog.metadata ? JSON.parse(dbLog.metadata) : undefined
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
                AND timestamp BETWEEN toDateTime64('${this.formatDate(startTime)}', 3)
                AND toDateTime64('${this.formatDate(endTime)}', 3)
            `;

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

        const dbLogs: LogEntryDB[] = await result.json();
        return dbLogs.map(this.convertToLogEntry);
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

        const summary = await result.json();
        return summary.map((item: any) => ({
            error_code: item.error_code,
            count: Number(item.count),
            latest_occurrence: new Date(item.latest_occurrence)
        }));
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