import { Queue } from 'bullmq';
import { ENV } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';

let reportQueue = null;
function getReportQueue() {
    // Avoid opening extra Redis connections in unit tests.
    if (process.env.NODE_ENV === 'test') return null;
    if (!reportQueue) {
        reportQueue = new Queue('ReportQueue', { connection: { url: ENV.REDIS_URL } });
    }
    return reportQueue;
}

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
        const queue = getReportQueue();
        if (!queue) {
            return res.status(501).json({ success: false, message: 'CSV export queue disabled in test mode' });
        }

        // 1. Instantly accept the request to prevent long-running HTTP timeout
        const job = await queue.add('export-csv', {
            userEmail: req.user.email,
            userId: req.dbUser?.id,
            timestamp: Date.now()
        });

        // 2. Return 202 Accepted. The worker will process it in the background.
        res.status(202).json({
            success: true,
            message: 'CSV Export started in the background. You will receive an email or socket notification when ready.',
            jobId: job.id
        });
    } catch (err) {
        next(err);
    }
};
