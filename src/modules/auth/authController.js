import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/prisma.js';

/**
 * Syncs the Firebase user with our PostgreSQL database.
 * If the user doesn't exist, they are created with a default 'staff' role.
 */
export const syncUser = async (req, res, next) => {
    try {
        const dbUser = req.dbUser;

        res.status(200).json({
            success: true,
            data: {
                id: dbUser.id,
                email: dbUser.email,
                role: dbUser.role
            }
        });

    } catch (error) {
        next(error);
    }
};
