import express from 'express';
import { syncUser } from './authController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';

const router = express.Router();

// GET /api/auth/sync
// Verifies token and syncs the user profile to PostgreSQL
router.get('/sync', verifyFirebaseToken, syncUser);

export default router;
