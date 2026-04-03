import express from 'express';
import { getProducts, createProduct, updateProduct, deleteProduct } from './productController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';
import { validateProduct } from '../../middleware/validate.js';

const router = express.Router();

// Publicly readable for all authenticated staff
router.get('/', verifyFirebaseToken, getProducts);

// Protected: Authenticated users can write to inventory
router.post('/', verifyFirebaseToken, validateProduct, createProduct);
router.put('/:id', verifyFirebaseToken, updateProduct);
router.delete('/:id', verifyFirebaseToken, deleteProduct);

export default router;
