import { Request, Response } from 'express'
import { BulkActionService } from '../services/bulk/bulkActionService.js'
import { LoggerService, LogLevel, LogEntry } from '../services/logging/loggingService.js'

export class BulkActionController {
    private bulkActionService = new BulkActionService()
    private logger = LoggerService.getInstance()

    async create(req: Request, res: Response) {
        try {
            const { actionType, configuration, scheduledFor } = req.body
            const accountId = req.user!.accountId
            const bulkAction = await this.bulkActionService.createBulkAction(
                Number(accountId),
                actionType,
                configuration,
                scheduledFor ? new Date(scheduledFor) : undefined
            )
            res.status(201).json(bulkAction)
        } catch (error) {
            res.status(500).json({ error: 'Failed to create bulk action' })
        }
    }

    async getStatus(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const bulkAction = await this.bulkActionService.getBulkAction(
                parseInt(id)
            );

            if (!bulkAction) {
                return res.status(404).json({ error: 'Bulk action not found' });
            }

            res.json(bulkAction);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get bulk action status' });
        }
    }

    async getStats(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const stats = await this.bulkActionService.getBulkActionStats(
                parseInt(id)
            );

            if (!stats) {
                return res.status(404).json({ error: 'Bulk action not found' });
            }

            res.json(stats);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get bulk action stats' });
        }
    }

    async getLogs(req: Request, res: Response) {
        try {
            const actionId = parseInt(req.params.id);
            const {
                startTime,
                endTime,
                level,
                limit,
                offset
            } = req.query;

            const logs = await this.logger.getBulkActionLogs(actionId, {
                startTime: startTime ? new Date(startTime as string) : undefined,
                endTime: endTime ? new Date(endTime as string) : undefined,
                level: level as LogLevel,
                limit: limit ? parseInt(limit as string) : undefined,
                offset: offset ? parseInt(offset as string) : undefined
            });

            res.json(logs);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve logs' });
        }
    }
    async getErrorSummary(req: Request, res: Response) {
        try {
            const actionId = parseInt(req.params.id);
            const summary = await this.logger.getErrorSummary(actionId);
            res.json(summary);
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve error summary' });
        }
    }
}