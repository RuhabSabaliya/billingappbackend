import express from 'express';
import { getCategories, createCategory, updateCategory } from './categoryController.js';
import { verifyFirebaseToken } from '../../middleware/auth.js';
import { adminOnly } from '../../middleware/role.js';

const router = express.Router();

// Publicly readable for all authenticated staff
router.get('/', verifyFirebaseToken, getCategories);

// Protected: Authenticated users can write
router.post('/', verifyFirebaseToken, createCategory);
router.put('/:id', verifyFirebaseToken, updateCategory);

export default router;
