import express from 'express';
import { getCustomers, createCustomer } from './customerController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';

const router = express.Router();

// Staff can view and add customers during checkout
router.get('/', verifyFirebaseToken, getCustomers);
router.post('/', verifyFirebaseToken, createCustomer);

export default router;
