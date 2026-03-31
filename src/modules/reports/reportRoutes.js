import express from 'express';
import { getBillsReport, exportToCSV } from './reportController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';
import { adminOnly } from '../../middleware/role.js';

const router = express.Router();

router.get('/', verifyFirebaseToken, adminOnly, getBillsReport);
router.post('/export/csv', verifyFirebaseToken, adminOnly, exportToCSV);

export default router;
