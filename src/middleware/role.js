export const adminOnly = (req, res, next) => {
    // req.dbUser will be populated by our own DB fetch after Firebase verification
    if (!req.dbUser || req.dbUser.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Forbidden: Admin access required' });
    }
    next();
};

export const staffAccess = (req, res, next) => {
    // Both admin and staff can access
    if (!req.dbUser || (req.dbUser.role !== 'admin' && req.dbUser.role !== 'staff')) {
        return res.status(403).json({ success: false, message: 'Forbidden: Insufficient permissions' });
    }
    next();
};
