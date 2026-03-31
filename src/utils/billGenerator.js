import { prisma as defaultPrisma } from '../config/prisma.js'; // Fallback if tx not provided

/**
 * Generates a sequential bill number (e.g., BILL-2026-0001)
 * Takes a Prisma TransactionClient (tx) to ensure atomicity within a transaction.
 */
export const generateBillNumber = async (tx = defaultPrisma) => {
    const currentYear = new Date().getFullYear().toString();
    const prefix = `BILL-${currentYear}-`;

    // Find the highest bill number in the current year
    const lastBill = await tx.bill.findFirst({
        where: { billNumber: { startsWith: prefix } },
        orderBy: { billNumber: 'desc' }
    });

    if (!lastBill) {
        return `${prefix}0001`; // First bill of the year
    }

    // Extract the numeric part (e.g., from 'BILL-2026-0042' -> 42)
    const lastSequenceStr = lastBill.billNumber.split('-')[2];
    const lastSequence = parseInt(lastSequenceStr, 10);

    if (isNaN(lastSequence)) {
        throw new Error('Corrupted bill number sequence in database');
    }

    const nextSequence = lastSequence + 1;
    // Pad with leading zeros up to 4 digits
    return `${prefix}${nextSequence.toString().padStart(4, '0')}`;
};
