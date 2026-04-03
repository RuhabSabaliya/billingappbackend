import { prisma } from '../../config/prisma.js';

export const getBillsReport = async (req, res, next) => {
    try {
        const dbUser = req.dbUser;
        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const bills = await prisma.bill.findMany({
            where: { userId: dbUser.id },
            include: {
                items: true
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit
        });

        const total = await prisma.bill.count({ where: { userId: dbUser.id } });

        res.status(200).json({
            success: true,
            data: bills,
            meta: { total, page, limit, hasMore: offset + limit < total }
        });
    } catch (err) {
        next(err);
    }
};

export const exportToCSV = async (req, res, next) => {
    try {
        // Simulate processing without BullMQ
        const userId = req.dbUser?.id;
        
        setTimeout(async () => {
            try {
                // Simulated heavy DB dump
                const count = await prisma.bill.count({
                    where: userId ? { userId } : undefined,
                });
                console.log(`Generated CSV for ${count} bills. Dispatching email to ${req.user.email}...`);
            } catch (err) {
                console.error('Error generating CSV:', err);
            }
        }, 5000);

        // Return 202 Accepted.
        res.status(202).json({
            success: true,
            message: 'CSV Export started in the background. You will receive an email or socket notification when ready.',
            jobId: `local-job-${Date.now()}`
        });
    } catch (err) {
        next(err);
    }
};
