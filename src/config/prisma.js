import { PrismaClient } from '@prisma/client';

// Prisma should be a singleton per Node process.
// Creating a new client per request/controller can exhaust DB connections.
export const prisma = new PrismaClient();

