export interface BulkAction {
    id: number;
    account_id: number;
    action_type: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'scheduled';
    total_records: number;
    processed_records: number;
    failed_records: number;
    skipped_records: number;
    scheduled_for?: Date;
    configuration: Record<string, any>;
    created_at: Date;
    updated_at: Date;
    completed_at?: Date;
}