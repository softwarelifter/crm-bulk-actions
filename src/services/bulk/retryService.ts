export class RetryService {
    private static readonly MAX_RETRIES = 3
    private static readonly RETRY_DELAY = 1000

    async retry<T>(operation: () => Promise<T>,
        context: { bulkActionId: number; batchId: number }
    ): Promise<T> {
        let lastError: Error | null = null
        for (let attempt = 0; attempt <= RetryService.MAX_RETRIES; attempt++) {
            try {
                return await operation()
            } catch (err) {
                lastError = err as Error
                //TODO: log retry
                if (attempt < RetryService.MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, RetryService.RETRY_DELAY))
                }
            }
        }
        throw lastError
    }
}