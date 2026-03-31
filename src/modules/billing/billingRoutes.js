import express from 'express';
import { createBill, getBillById, getBillHistory, exportBillsCsv } from './billingController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';

const router = express.Router();

router.post('/', verifyFirebaseToken, createBill);
router.get('/history', verifyFirebaseToken, getBillHistory);
router.get('/export/csv', verifyFirebaseToken, exportBillsCsv);
router.get('/:id', verifyFirebaseToken, getBillById);

export default router;
