-- Connect to ClickHouse client and run:

-- Create the database
CREATE DATABASE IF NOT EXISTS crm_bulk_actions;

-- Use the database
USE crm_bulk_actions;

-- Create the logs table
CREATE TABLE IF NOT EXISTS bulk_action_logs (
    log_id UUID DEFAULT generateUUIDv4(),
    timestamp DateTime64(3) DEFAULT now64(3),
    bulk_action_id UInt64,
    batch_id Nullable(UInt64),
    account_id UInt64,
    entity_id Nullable(UInt64),
    operation_type LowCardinality(String),
    status LowCardinality(String),
    level LowCardinality(String),
    message String,
    error_code Nullable(String),
    error_details Nullable(String),
    metadata Nullable(String),
    processing_time_ms UInt32,
    retry_count UInt8 DEFAULT 0
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (timestamp, bulk_action_id, batch_id);

-- Create materialized view for error aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS bulk_action_error_summary
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (error_code, bulk_action_id)
AS SELECT
    timestamp,
    bulk_action_id,
    error_code,
    count() as error_count,
    max(timestamp) as latest_occurrence
FROM bulk_action_logs
WHERE level = 'ERROR'
GROUP BY timestamp, bulk_action_id, error_code;

-- Create materialized view for performance metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS bulk_action_performance_metrics
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (bulk_action_id, toStartOfHour(timestamp))
AS SELECT
    toStartOfHour(timestamp) as hour,
    bulk_action_id,
    avg(processing_time_ms) as avg_processing_time,
    count() as operation_count,
    countIf(level = 'ERROR') as error_count
FROM bulk_action_logs
GROUP BY
    hour,
    bulk_action_id;