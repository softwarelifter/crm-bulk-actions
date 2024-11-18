import { Router } from 'express';
import { ContactController } from '../controllers/contactController.js';
import { authMiddleware } from '../middlewares/auth.js';
import { rateLimiterMiddleware } from '../middlewares/rateLimiter.js';

const router = Router();
const controller = new ContactController();

router.use(authMiddleware);
router.use(rateLimiterMiddleware);

router.post('/', controller.create.bind(controller));
router.get('/:id', controller.get.bind(controller));
router.put('/:id', controller.update.bind(controller));
router.delete('/:id', controller.delete.bind(controller));
router.get('/', controller.list.bind(controller));

export default router;