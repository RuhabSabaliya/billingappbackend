import express from 'express';
import { batchSyncBills } from './syncController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';

const router = express.Router();

router.post('/', verifyFirebaseToken, batchSyncBills);

export default router;
