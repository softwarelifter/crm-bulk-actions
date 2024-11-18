// src/routes/auth.ts
import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';

const router = Router();
const controller = new AuthController();

router.post('/register', controller.register.bind(controller));
router.post('/login', controller.login.bind(controller));
router.post('/refresh', controller.refreshToken.bind(controller));
router.post('/logout', controller.logout.bind(controller));

export default router;