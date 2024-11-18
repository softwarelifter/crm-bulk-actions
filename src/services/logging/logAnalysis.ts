import { clickHouse } from '../../config/clickHouse.js';
import { LoggerService, LogLevel } from './loggingService.js';

export class LogAnalysisService {
    private logger: LoggerService;

    constructor() {
        this.logger = LoggerService.getInstance();
    }

    async getProcessingMetrics(bulkActionId: number): Promise<{
        totalProcessingTime: number;
        averageProcessingTime: number;
        errorRate: number;
        retryRate: number;
    } | unknown> {
        const query = `
      SELECT
        sum(processing_time_ms) as total_processing_time,
        avg(processing_time_ms) as average_processing_time,
        countIf(level = 'ERROR') * 100.0 / count() as error_rate,
        avg(retry_count) as average_retries
      FROM bulk_action_logs
      WHERE bulk_action_id = ${bulkActionId}
    `;

        const result = await clickHouse.query({
            query,
            format: 'JSONEachRow'
        });

        return result.json();
    }

    async getTimeSeriesAnalysis(
        bulkActionId: number,
        interval: '1m' | '5m' | '1h' = '5m'
    ): Promise<{
        timestamp: Date;
        processed_count: number;
        error_count: number;
        average_processing_time: number;
    }[]> {
        const query = `
      SELECT
        toStartOfInterval(timestamp, INTERVAL ${interval}) as time_bucket,
        count() as total_operations,
        countIf(level = 'ERROR') as error_count,
        avg(processing_time_ms) as average_processing_time
      FROM bulk_action_logs
      WHERE bulk_action_id = ${bulkActionId}
      GROUP BY time_bucket
      ORDER BY time_bucket
    `;

        const result = await clickHouse.query({
            query,
            format: 'JSONEachRow'
        });

        return result.json();
    }
}