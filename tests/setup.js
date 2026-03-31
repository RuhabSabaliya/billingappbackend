import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Teardown the DB connection cleanly after all tests finish
afterAll(async () => {
    await prisma.$disconnect();
});
