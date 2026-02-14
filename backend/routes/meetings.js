import express from 'express';
import * as meetingsController from '../controllers/meetingsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Protected routes
router.post('/start', authenticateToken, meetingsController.createMeeting);
router.get('/history', authenticateToken, meetingsController.getMeetingHistory);
router.get('/list', authenticateToken, meetingsController.getActiveMeetings);
router.post('/end', authenticateToken, meetingsController.endMeeting);

// Public/semi-public routes
router.get('/validate/:link', meetingsController.validateMeeting);
router.get('/active', meetingsController.getActiveMeetings);
router.get('/:link', meetingsController.getMeetingDetails);
router.post('/join', meetingsController.joinMeeting);
router.post('/get-token', meetingsController.getLiveKitToken);

export default router;
