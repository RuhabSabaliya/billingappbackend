import { logger } from '../../utils/logger.js';
import { prisma } from '../../config/prisma.js';
import { generateBillNumber } from '../../utils/billGenerator.js';

function asNumber(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeOfflineBill(b) {
    const offlineBillId = b?.offlineBillId ?? b?.offlineBillID ?? b?.id ?? null;
    const itemsRaw = Array.isArray(b?.items) ? b.items : [];
    const items = itemsRaw
        .map((i) => ({
            productId: i.productId ?? i.id ?? null,
            productName: (i.productName ?? i.name ?? '').toString().trim(),
            price: asNumber(i.price),
            quantity: asNumber(i.quantity),
        }))
        .filter((i) => i.productName && i.price != null && i.quantity != null && i.quantity > 0);

    return {
        offlineBillId,
        items,
        totalAmount: asNumber(b?.totalAmount ?? b?.total) ?? 0,
        taxAmount: asNumber(b?.taxAmount) ?? 0,
        discountAmount: asNumber(b?.discountAmount) ?? 0,
        timestamp: b?.timestamp ?? b?.createdAt ?? null,
        customerId: b?.customerId ?? null,
        customer: b?.customer ?? null,
    };
}

export const batchSyncBills = async (req, res, next) => {
    try {
        const { batches } = req.body; // Array of offline bills
        const dbUser = req.dbUser;

        if (!Array.isArray(batches) || batches.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid payload: expected an array of bills' });
        }

        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const syncedIds = [];
        const failedIds = [];

        for (const offlineBill of batches) {
            try {
                const normalized = normalizeOfflineBill(offlineBill);
                if (!normalized.offlineBillId) {
                    failedIds.push(null);
                    continue;
                }
                if (!normalized.items.length || normalized.totalAmount <= 0) {
                    failedIds.push(normalized.offlineBillId);
                    continue;
                }

                // 1. Check idempotency: Did we already sync this bill in a drops connection scenario?
                const existing = await prisma.bill.findFirst({
                    where: { id: normalized.offlineBillId, userId: dbUser.id }
                });

                if (existing) {
                    // Already synced successfully prior, just tell frontend to clear it
                    syncedIds.push(normalized.offlineBillId);
                    continue;
                }

                // 2. Perform atomic insert + stock deduction
                await prisma.$transaction(async (tx) => {
                    const billNumber = await generateBillNumber(tx);

                    // Resolve / upsert customer (optional, scoped to user)
                    let resolvedCustomerId = normalized.customerId || null;
                    const phone = normalized.customer?.phone?.toString().trim() || '';
                    const name = normalized.customer?.name?.toString().trim() || '';

                    if (resolvedCustomerId) {
                        const c = await tx.customer.findFirst({
                            where: { id: resolvedCustomerId, userId: dbUser.id, isActive: true }
                        });
                        if (!c) throw new Error('CUSTOMER_FORBIDDEN');
                    }

                    if (!resolvedCustomerId && (phone || name)) {
                        if (phone) {
                            const existingCustomer = await tx.customer.findFirst({
                                where: { userId: dbUser.id, phone, isActive: true }
                            });
                            if (existingCustomer) {
                                if (name) {
                                    await tx.customer.update({
                                        where: { id: existingCustomer.id },
                                        data: { name, isActive: true }
                                    });
                                }
                                resolvedCustomerId = existingCustomer.id;
                            } else {
                                const c = await tx.customer.create({
                                    data: { userId: dbUser.id, phone, name: name || null, isActive: true }
                                });
                                resolvedCustomerId = c.id;
                            }
                        } else {
                            const c = await tx.customer.create({
                                data: { userId: dbUser.id, name: name || null, isActive: true }
                            });
                            resolvedCustomerId = c.id;
                        }
                    }

                    // Security: ensure referenced products belong to this user.
                    const productIds = normalized.items.map((it) => it.productId).filter(Boolean);
                    if (productIds.length > 0) {
                        const validProducts = await tx.product.findMany({
                            where: { id: { in: productIds }, userId: dbUser.id },
                            select: { id: true },
                        });
                        const validSet = new Set(validProducts.map((p) => p.id));
                        const bad = productIds.filter((pid) => !validSet.has(pid));
                        if (bad.length) {
                            throw new Error('FORBIDDEN_PRODUCTS');
                        }
                    }

                    await tx.bill.create({
                        data: {
                            id: normalized.offlineBillId, // Strict ID mapping from IndexedDB
                            billNumber,
                            userId: dbUser.id,
                            customerId: resolvedCustomerId,
                            totalAmount: normalized.totalAmount,
                            taxAmount: normalized.taxAmount,
                            discountAmount: normalized.discountAmount,
                            status: 'SYNCED',
                            ...(normalized.timestamp ? { createdAt: new Date(normalized.timestamp) } : {}),
                            items: {
                                create: normalized.items.map((item) => ({
                                    productId: item.productId,
                                    productName: item.productName,
                                    price: item.price,
                                    quantity: item.quantity
                                }))
                            }
                        }
                    });

                });

                syncedIds.push(normalized.offlineBillId);
            } catch (innerError) {
                logger.error(`Failed to sync bill: ${innerError.message}`);
                failedIds.push(offlineBill?.offlineBillId ?? null);
            }
        }

        res.status(200).json({
            success: true,
            data: { synced: syncedIds, failed: failedIds }
        });

    } catch (err) {
        next(err);
    }
};
