import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as notificationsController from '../controllers/notificationsController.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', notificationsController.getNotifications);
router.put('/:id/read', notificationsController.markAsRead);
router.put('/read-all', notificationsController.markAllAsRead);

export default router;
