import { auth } from '../config/firebase.js';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export const verifyFirebaseToken = async (req, res, next) => {
    try {
        // Test-only bypass (used by Jest + Supertest).
        // Requires NODE_ENV=test and an explicit header so it can't be triggered accidentally.
        if (process.env.NODE_ENV === 'test' && req.header('X-Test-User-Uid')) {
            req.user = {
                uid: req.header('X-Test-User-Uid'),
                email: req.header('X-Test-User-Email') ?? 'test@example.com',
            };
        }

        const authHeader = req.headers.authorization;
        if (!req.user && (!authHeader || !authHeader.startsWith('Bearer '))) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
        }

        const idToken = req.user ? null : authHeader.split('Bearer ')[1];

        // Verify the Firebase ID token
        const decodedToken = req.user ?? (await auth.verifyIdToken(idToken));

        // Attach the decoded Firebase token to request
        req.user = decodedToken;

        // Ensure the user exists in our DB and attach db user for RBAC
        const uid = decodedToken?.uid;
        const email = decodedToken?.email ?? null;
        if (!uid) {
            return res.status(401).json({ success: false, message: 'Unauthorized: Invalid token payload' });
        }

        let dbUser = await prisma.user.findUnique({ where: { firebaseUid: uid } });
        if (!dbUser) {
            dbUser = await prisma.user.create({
                data: {
                    firebaseUid: uid,
                    email: email ?? `${uid}@unknown.local`,
                    role: 'staff',
                    isActive: true,
                },
            });
            logger.info(`Auto-provisioned user ${dbUser.email} (${dbUser.id})`);
        } else if (!dbUser.isActive) {
            return res.status(403).json({ success: false, message: 'Account has been deactivated' });
        }

        req.dbUser = dbUser;
        next();
    } catch (error) {
        logger.warn(`Auth failed: ${error.message}`);
        return res.status(401).json({ success: false, message: 'Unauthorized: Token expired or invalid' });
    }
};
