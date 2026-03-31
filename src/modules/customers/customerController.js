import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/prisma.js';

export const getCustomers = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const customers = await prisma.customer.findMany({
            where: { userId, isActive: true },
            orderBy: { name: 'asc' },
            skip: offset,
            take: limit
        });

        res.status(200).json({ success: true, data: customers });
    } catch (err) {
        next(err);
    }
};

export const createCustomer = async (req, res, next) => {
    try {
        const userId = req.dbUser.id;
        const { name, phone } = req.body;

        const customer = await prisma.customer.create({
            data: { userId, name, phone, isActive: true }
        });

        logger.info(`Customer added: ${name} (${phone})`);
        res.status(201).json({ success: true, data: customer });
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Phone number already registered for this user' });
        next(err);
    }
};
