import express from 'express';
import { getSettings, updateSettings } from './settingsController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';
import { adminOnly } from '../../middleware/role.js';

const router = express.Router();

// Allow any authenticated user (staff or admin) to read settings
router.get('/', verifyFirebaseToken, getSettings);

// Only admins can modify settings
router.put('/', verifyFirebaseToken, adminOnly, updateSettings);

export default router;
