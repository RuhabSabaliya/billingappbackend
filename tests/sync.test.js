import request from 'supertest';
import app from '../src/app.js';
import crypto from 'crypto';
import redisClient from '../src/config/redis.js';
import { prisma } from '../src/config/prisma.js';

// Note: To run this test you need a running PostgreSQL database
// and a Firebase Token flow. In tests, we bypass Firebase by sending X-Test-User-* headers.

describe('Offline Batch Sync API (/api/sync)', () => {
    let dbUser;
    let testProduct;

    beforeAll(async () => {
        // 1. Seed dummy user and product
        dbUser = await prisma.user.upsert({
            where: { firebaseUid: 'test-user-uid' },
            update: {},
            create: { firebaseUid: 'test-user-uid', email: 'test@example.com', role: 'admin' }
        });

        const category = await prisma.category.create({ data: { userId: dbUser.id, name: 'Test Category' } });

        testProduct = await prisma.product.create({
            data: {
                userId: dbUser.id,
                categoryId: category.id,
                name: 'Test TestProduct',
                price: 99.99,
                stock: 100
            }
        });
    });

    afterAll(async () => {
        // Clean up created entities
        await prisma.billItem.deleteMany({});
        await prisma.bill.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.category.deleteMany({});
        await prisma.user.deleteMany({});

        await prisma.$disconnect();
        await redisClient.quit();
    });

    it('should successfully sync a batch of offline bills idempotently', async () => {
        const offlineBillId = crypto.randomUUID();

        const payload = {
            batches: [
                {
                    offlineBillId,
                    customerId: null,
                    totalAmount: 199.98,
                    taxAmount: 0,
                    discountAmount: 0,
                    timestamp: Date.now(),
                    items: [
                        {
                            productId: testProduct.id,
                            productName: 'Test TestProduct',
                            price: 99.99,
                            quantity: 2
                        }
                    ]
                }
            ]
        };

        // First attempt -> Should insert
        const res1 = await request(app)
            .post('/api/sync')
            .set('X-Test-User-Uid', 'test-user-uid')
            .set('X-Test-User-Email', 'test@example.com')
            .send(payload);

        expect(res1.status).toBe(200);
        expect(res1.body.data.synced).toContain(offlineBillId);

        // Verify stock was NOT deducted (inventory tracking disabled)
        const updatedProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
        expect(updatedProduct.stock).toBe(100);

        // Second attempt -> Should IDEMPOTENTLY SUCCEED without duplicating DB rows or deducting stock again
        const res2 = await request(app)
            .post('/api/sync')
            .set('X-Test-User-Uid', 'test-user-uid')
            .set('X-Test-User-Email', 'test@example.com')
            .send(payload);

        expect(res2.status).toBe(200);
        expect(res2.body.data.synced).toContain(offlineBillId); // Still returns synced so client clears IDB

        const duplicateCheck = await prisma.bill.count({ where: { id: offlineBillId } });
        expect(duplicateCheck).toBe(1); // Still only 1 row!

        const finalProduct = await prisma.product.findUnique({ where: { id: testProduct.id } });
        expect(finalProduct.stock).toBe(100); // Stock wasn't deducted again!
    });
});
