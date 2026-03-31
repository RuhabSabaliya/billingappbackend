import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Advanced Temporal Tax Engine
 * Fetches the correct tax rate based on the date of the transaction,
 * allowing governments to change rates without altering historical retail bills.
 */
export const calculateTaxForDate = async (categoryId, transactionDate = new Date()) => {
    // In a real DB, you query a Temporal Tax table:
    /*
      return await prisma.taxRule.findFirst({
        where: { 
          categoryId: categoryId,
          effectiveFrom: { lte: transactionDate },
          effectiveTo: { gte: transactionDate } // Or Null
        },
        orderBy: { effectiveFrom: 'desc' }
      });
    */

    // Mock logic
    if (transactionDate < new Date('2026-07-01')) {
        return 18.0; // 18% GST before July 1
    }
    return 20.0; // 20% GST after July 1
};
