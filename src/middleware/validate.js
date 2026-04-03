export const validateProduct = (req, res, next) => {
    const { name, price, categoryId } = req.body;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid or missing product name' });
    }
    if (price === undefined || isNaN(price) || price < 0) {
        return res.status(400).json({ success: false, message: 'Invalid or missing product price' });
    }
    if (!categoryId || typeof categoryId !== 'string') {
        return res.status(400).json({ success: false, message: 'Invalid or missing categoryId' });
    }
    next();
};
