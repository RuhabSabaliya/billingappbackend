import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const openShift = async (req, res, next) => {
    try {
        const { storeId, startingCash } = req.body;
        const userId = req.user.uid;

        const dbUser = await prisma.user.findUnique({ where: { firebaseUid: userId } });

        // In a real app, this would insert into a `Shift` table
        // For this demonstration, we return a success payload tracking the float
        res.status(201).json({
            success: true,
            message: 'Shift Opened',
            data: {
                shiftId: 'SHIFT-001',
                storeId,
                cashierId: dbUser.id,
                startingCash,
                openedAt: new Date()
            }
        });

    } catch (err) {
        next(err);
    }
};

export const closeShift = async (req, res, next) => {
    try {
        const { shiftId, declaredCash } = req.body;

        // Simulate fetching all bills during this shift to calculate expected cash
        const expectedCash = 500.00; // Mock calculation
        const difference = declaredCash - expectedCash;

        res.status(200).json({
            success: true,
            message: 'Shift Closed',
            data: {
                shiftId,
                expectedCash,
                declaredCash,
                overageShortage: difference,
                closedAt: new Date()
            }
        });

    } catch (err) {
        next(err);
    }
};
