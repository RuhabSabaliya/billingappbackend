import { prisma } from '../../config/prisma.js';
import { generateBillNumber } from '../../utils/billGenerator.js';

function asNumber(v) {
    if (v === undefined || v === null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function normalizeCreateBillPayload(body) {
    // Frontend payload shape:
    // { items: [{productId,name,price,quantity,subtotal,...}], total, customer, createdAt }
    // Legacy/alternate shape:
    // { customerId, totalAmount, taxAmount, discountAmount, items: [{productId,productName,price,quantity}] }
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    const items = itemsRaw
        .map((i) => ({
            productId: i.productId ?? i.id ?? null,
            productName: (i.productName ?? i.name ?? '').toString().trim(),
            price: asNumber(i.price),
            quantity: asNumber(i.quantity),
        }))
        .filter((i) => i.productName && i.price != null && i.quantity != null && i.quantity > 0);

    return {
        items,
        totalAmount: asNumber(body?.totalAmount ?? body?.total),
        taxAmount: asNumber(body?.taxAmount) ?? 0,
        discountAmount: asNumber(body?.discountAmount) ?? 0,
        customerId: body?.customerId ?? null,
        customer: body?.customer ?? null,
        createdAt: body?.createdAt ?? null,
    };
}

function toFrontendBillDto(bill) {
    if (!bill) return bill;
    const items = (bill.items ?? []).map((it) => {
        const price = asNumber(it.price) ?? 0;
        const qty = asNumber(it.quantity) ?? 0;
        return {
            productId: it.productId ?? null,
            name: it.productName ?? '',
            price,
            quantity: qty,
            subtotal: +(price * qty).toFixed(2),
        };
    });

    const total = asNumber(bill.totalAmount) ?? 0;
    return {
        id: bill.id,
        billNumber: bill.billNumber,
        createdAt: bill.createdAt,
        customer: bill.customer
            ? { id: bill.customer.id, name: bill.customer.name, phone: bill.customer.phone }
            : null,
        items,
        total,
        syncStatus: bill.status === 'SYNCED' ? 'synced' : 'synced',
    };
}

export const createBill = async (req, res, next) => {
    try {
        const offlineBillId = req.header('X-Offline-Bill-Id') || null;
        const { customerId, customer, totalAmount, taxAmount, discountAmount, items, createdAt } =
            normalizeCreateBillPayload(req.body);

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: 'Bill items are required.' });
        }
        if (totalAmount === null || totalAmount <= 0) {
            return res.status(400).json({ success: false, message: 'A valid total amount is required.' });
        }

        const dbUser = req.dbUser;
        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        // Idempotency for offline sync: if the client provided a stable ID, reuse it.
        if (offlineBillId) {
            const existing = await prisma.bill.findFirst({
                where: { id: offlineBillId, userId: dbUser.id },
                include: { items: true, customer: true },
            });
            if (existing) return res.status(200).json({ success: true, data: toFrontendBillDto(existing) });
        }

        // Requires Prisma Transaction to ensure bill and items both insert successfully
        const result = await prisma.$transaction(async (tx) => {
            // Resolve / upsert customer (optional)
            let resolvedCustomerId = customerId || null;
            const phone = customer?.phone?.toString().trim() || '';
            const name = customer?.name?.toString().trim() || '';

            if (resolvedCustomerId) {
                const c = await tx.customer.findFirst({
                    where: { id: resolvedCustomerId, userId: dbUser.id, isActive: true },
                });
                if (!c) {
                    const e = new Error('Forbidden: Customer does not belong to this user.');
                    e.statusCode = 403;
                    e.isOperational = true;
                    throw e;
                }
            }

            if (!resolvedCustomerId && (phone || name)) {
                if (phone) {
                    const existing = await tx.customer.findFirst({ where: { userId: dbUser.id, phone, isActive: true } });
                    if (existing) {
                        if (name) {
                            await tx.customer.update({ where: { id: existing.id }, data: { name, isActive: true } });
                        }
                        resolvedCustomerId = existing.id;
                    } else {
                        const c = await tx.customer.create({
                            data: { userId: dbUser.id, phone, name: name || null, isActive: true },
                        });
                        resolvedCustomerId = c.id;
                    }
                } else {
                    const c = await tx.customer.create({ data: { userId: dbUser.id, name: name || null, isActive: true } });
                    resolvedCustomerId = c.id;
                }
            }

            // Security: ensure referenced products belong to this user.
            const productIds = items.map((it) => it.productId).filter(Boolean);
            if (productIds.length > 0) {
                const validProducts = await tx.product.findMany({
                    where: { id: { in: productIds }, userId: dbUser.id },
                    select: { id: true },
                });
                const validSet = new Set(validProducts.map((p) => p.id));
                const bad = productIds.filter((pid) => !validSet.has(pid));
                if (bad.length) {
                    const e = new Error('Forbidden: One or more products do not belong to this user.');
                    e.statusCode = 403;
                    e.isOperational = true;
                    throw e;
                }
            }

            const billNumber = await generateBillNumber(tx);

            // 2. Create Bill
            const bill = await tx.bill.create({
                data: {
                    ...(offlineBillId ? { id: offlineBillId } : {}),
                    billNumber,
                    userId: dbUser.id,
                    customerId: resolvedCustomerId,
                    totalAmount,
                    taxAmount,
                    discountAmount,
                    status: 'COMPLETED',
                    ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            productName: item.productName,
                            price: item.price,
                            quantity: item.quantity
                        }))
                    }
                },
                include: { items: true, customer: true }
            });

            return bill;
        });

        res.status(201).json({ success: true, data: toFrontendBillDto(result) });
    } catch (err) {
        next(err);
    }
};

export const getBillById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const dbUser = req.dbUser;
        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const bill = await prisma.bill.findFirst({
            where: { id, userId: dbUser.id },
            include: { items: true, customer: true },
        });
        if (!bill) return res.status(404).json({ success: false, message: 'Bill not found' });
        return res.status(200).json({ success: true, data: toFrontendBillDto(bill) });
    } catch (err) {
        next(err);
    }
};

export const getBillHistory = async (req, res, next) => {
    try {
        const dbUser = req.dbUser;
        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { dateFrom = '', dateTo = '', search = '' } = req.query;

        const where = { userId: dbUser.id };

        const createdAt = {};
        if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
        if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
        if (Object.keys(createdAt).length) where.createdAt = createdAt;

        if (search) {
            where.OR = [
                { billNumber: { contains: String(search), mode: 'insensitive' } },
                { customer: { name: { contains: String(search), mode: 'insensitive' } } },
                { customer: { phone: { contains: String(search), mode: 'insensitive' } } },
            ];
        }

        const bills = await prisma.bill.findMany({
            where,
            include: { items: true, customer: true },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });

        res.status(200).json({ success: true, data: bills.map(toFrontendBillDto) });
    } catch (err) {
        next(err);
    }
};

export const exportBillsCsv = async (req, res, next) => {
    try {
        const dbUser = req.dbUser;
        if (!dbUser) return res.status(401).json({ success: false, message: 'Unauthorized' });

        const { dateFrom = '', dateTo = '', search = '' } = req.query;
        const where = { userId: dbUser.id };
        const createdAt = {};
        if (dateFrom) createdAt.gte = new Date(`${dateFrom}T00:00:00.000Z`);
        if (dateTo) createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`);
        if (Object.keys(createdAt).length) where.createdAt = createdAt;
        if (search) {
            where.OR = [
                { billNumber: { contains: String(search), mode: 'insensitive' } },
                { customer: { name: { contains: String(search), mode: 'insensitive' } } },
                { customer: { phone: { contains: String(search), mode: 'insensitive' } } },
            ];
        }

        const bills = await prisma.bill.findMany({
            where,
            include: { customer: true, items: true },
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });

        const header = ['billNumber', 'createdAt', 'customerName', 'customerPhone', 'itemsCount', 'total'];
        const lines = [header.join(',')];
        for (const b of bills) {
            const dto = toFrontendBillDto(b);
            const row = [
                JSON.stringify(dto.billNumber ?? ''),
                JSON.stringify(new Date(dto.createdAt).toISOString()),
                JSON.stringify(dto.customer?.name ?? ''),
                JSON.stringify(dto.customer?.phone ?? ''),
                String(dto.items?.length ?? 0),
                String(dto.total ?? 0),
            ];
            lines.push(row.join(','));
        }

        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="bills-export.csv"`);
        res.status(200).send(csv);
    } catch (err) {
        next(err);
    }
};
