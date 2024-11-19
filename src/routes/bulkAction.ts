import { Router } from 'express'
import { BulkActionController } from '../controllers/bulkActionController.js'
import { authMiddleware } from '../middlewares/auth.js'
import { rateLimiterMiddleware } from '../middlewares/rateLimiter.js'
import { LogAnalysisService } from '../services/logging/logAnalysis.js'

const router = Router()
const controller = new BulkActionController()

router.use(authMiddleware)
router.use(rateLimiterMiddleware)


router.post("/", controller.create.bind(controller))
router.get("/", controller.list.bind(controller))
router.get("/:id", controller.getStatus.bind(controller))
router.get("/:id/stats", controller.getStats.bind(controller))
router.get('/:id/logs', controller.getLogs.bind(controller));
router.get('/:id/errors', controller.getErrorSummary.bind(controller));

router.get('/:id/metrics', async (req, res) => {
    const analysisService = new LogAnalysisService();
    const metrics = await analysisService.getProcessingMetrics(parseInt(req.params.id));
    res.json(metrics);
});

router.get('/:id/timeseries', async (req, res) => {
    const analysisService = new LogAnalysisService();
    const timeseries = await analysisService.getTimeSeriesAnalysis(
        parseInt(req.params.id),
        req.query.interval as '1m' | '5m' | '1h'
    );
    res.json(timeseries);
});
export default router