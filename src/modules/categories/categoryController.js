import { logger } from '../../utils/logger.js';
import redisClient from '../../config/redis.js';
import { prisma } from '../../config/prisma.js';

const CACHE_KEY = (userId) => `categories:${userId}:all`;

export const getCategories = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        // 1. Check Redis Cache
        const cached = await redisClient.get(CACHE_KEY(userId));
        if (cached) {
            return res.status(200).json({ success: true, data: JSON.parse(cached) });
        }

        // 2. Fetch from DB
        const categories = await prisma.category.findMany({
            where: { userId, isActive: true },
            orderBy: { name: 'asc' }
        });

        // 3. Set Cache (1 hour expiry)
        await redisClient.set(CACHE_KEY(userId), JSON.stringify(categories), 'EX', 3600);

        res.status(200).json({ success: true, data: categories });
    } catch (err) {
        next(err);
    }
};

export const createCategory = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { name } = req.body;
        if (!name || name.toString().trim() === '') {
            return res.status(400).json({ success: false, message: 'Category name is required' });
        }

        const newCategory = await prisma.category.create({
            data: { userId, name: name.toString().trim() }
        });

        // Invalidate Cache
        await redisClient.del(CACHE_KEY(userId));

        logger.info(`Category created: ${name}`);
        res.status(201).json({ success: true, data: newCategory });
    } catch (err) {
        // Unique constraint violation (P2002)
        if (err.code === 'P2002') {
                return res.status(409).json({ success: false, message: 'Category already exists for this user' });
        }
        next(err);
    }
};

export const updateCategory = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { id } = req.params;
        const { name, isActive } = req.body;

        const existing = await prisma.category.findFirst({ where: { id, userId } });
        if (!existing) return res.status(404).json({ success: false, message: 'Category not found' });

        const category = await prisma.category.update({
            where: { id },
            data: { name: name ?? undefined, isActive }
        });

        // Invalidate Cache
        await redisClient.del(CACHE_KEY(userId));

        res.status(200).json({ success: true, data: category });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ success: false, message: 'Category not found' });
        next(err);
    }
};
