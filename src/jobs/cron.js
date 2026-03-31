import cron from 'node-cron';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/prisma.js';

// Run at 03:00 AM every Sunday
export const gcJob = cron.schedule('0 3 * * 0', async () => {
    logger.info('Running weekly Garbage Collection (Soft-Delete Cleanup)');

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    try {
        const deletedProducts = await prisma.product.deleteMany({
            where: {
                isActive: false,
                updatedAt: { lt: ninetyDaysAgo }
            }
        });

        logger.info(`Garbage Collection: permanently deleted ${deletedProducts.count} old products`);
    } catch (err) {
        logger.error(`Garbage Collection failed: ${err.message}`);
    }
}, {
    scheduled: false // Requires manual worker.start() inside server.js to prevent tests hanging
});

export default gcJob;
