import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/prisma.js';
import { emitEvent } from '../../realtime/io.js';

export const getProducts = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const products = await prisma.product.findMany({
            where: { userId, isActive: true },
            include: { category: true },
            orderBy: { name: 'asc' },
            skip: offset,
            take: limit
        });

        res.status(200).json({ success: true, data: products });
    } catch (err) {
        next(err);
    }
};

export const createProduct = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { categoryId, newCategoryName, name, price, stock, barcode } = req.body;

        // Validate required fields
        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Product name is required.' });
        }
        if (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive price is required.' });
        }

        // Resolve the category ID
        let resolvedCategoryId = categoryId;

        if (!resolvedCategoryId && newCategoryName) {
            // Create new category on the fly, or reuse an existing one with the same name
            const trimmed = newCategoryName.trim();
            if (!trimmed) {
                return res.status(400).json({ success: false, message: 'New category name cannot be empty.' });
            }

            const existing = await prisma.category.findFirst({
                where: { userId, name: trimmed }
            });

            const category = existing
                ? await prisma.category.update({
                    where: { id: existing.id },
                    data: { isActive: true },
                })
                : await prisma.category.create({
                    data: { userId, name: trimmed, isActive: true },
                });

            resolvedCategoryId = category.id;
        }

        if (!resolvedCategoryId) {
            return res.status(400).json({ success: false, message: 'A category is required to create a product.' });
        }

        // Ensure category belongs to the user
        const category = await prisma.category.findFirst({ where: { id: resolvedCategoryId, userId, isActive: true } });
        if (!category) return res.status(403).json({ success: false, message: 'Forbidden: Category does not belong to this user.' });

        const newProduct = await prisma.product.create({
            data: {
                userId,
                categoryId: resolvedCategoryId,
                name: name.trim(),
                price: parseFloat(price),
                // Inventory tracking disabled: keep stock field at default.
                stock: 0,
                barcode: barcode || null,
            },
            include: { category: true },
        });

        // Real-time: notify all connected dashboards
        emitEvent('INVENTORY_UPDATED', newProduct);

        res.status(201).json({ success: true, data: newProduct });
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ success: false, message: 'Duplicate category or barcode for this user.' });
        }
        next(err);
    }
};

export const updateProduct = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { id } = req.params;
        const { categoryId, newCategoryName, name, price, stock, barcode, isActive } = req.body;

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, message: 'Product name is required.' });
        }
        if (price === undefined || price === null || isNaN(parseFloat(price)) || parseFloat(price) <= 0) {
            return res.status(400).json({ success: false, message: 'A valid positive price is required.' });
        }

        let resolvedCategoryId = categoryId;
        if (!resolvedCategoryId && newCategoryName) {
            const trimmed = newCategoryName.trim();
            if (!trimmed) {
                return res.status(400).json({ success: false, message: 'New category name cannot be empty.' });
            }

            const existing = await prisma.category.findFirst({
                where: { userId, name: trimmed }
            });

            const category = existing
                ? await prisma.category.update({
                    where: { id: existing.id },
                    data: { isActive: true },
                })
                : await prisma.category.create({
                    data: { userId, name: trimmed, isActive: true },
                });

            resolvedCategoryId = category.id;
        }

        if (!resolvedCategoryId) {
            return res.status(400).json({ success: false, message: 'A category is required to update a product.' });
        }

        // Ensure product belongs to user
        const existingProduct = await prisma.product.findFirst({ where: { id, userId } });
        if (!existingProduct) return res.status(404).json({ success: false, message: 'Product not found' });

        // Ensure category belongs to user
        const category = await prisma.category.findFirst({ where: { id: resolvedCategoryId, userId, isActive: true } });
        if (!category) return res.status(403).json({ success: false, message: 'Forbidden: Category does not belong to this user.' });

        const updatedProduct = await prisma.product.update({
            where: { id },
            data: {
                userId,
                categoryId: resolvedCategoryId,
                name: name.trim(),
                price: parseFloat(price),
                // Inventory tracking disabled.
                stock: 0,
                barcode: barcode || null,
                // Soft delete uses isActive; allow explicit change.
                isActive: isActive ?? existingProduct.isActive,
            },
            include: { category: true }
        });

        emitEvent('INVENTORY_UPDATED', updatedProduct);

        res.status(200).json({ success: true, data: updatedProduct });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Product not found' });
        if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Duplicate category or barcode for this user.' });
        next(err);
    }
};

export const deleteProduct = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { id } = req.params;

        const existing = await prisma.product.findFirst({ where: { id, userId } });
        if (!existing) return res.status(404).json({ success: false, message: 'Product not found' });

        const deleted = await prisma.product.update({
            where: { id },
            data: { isActive: false, stock: 0 },
            include: { category: true },
        });
        res.status(200).json({ success: true, data: id });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Product not found' });
        next(err);
    }
};

