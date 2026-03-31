import redisClient from '../../config/redis.js';

const SETTINGS_KEY = 'app:settings';

const DEFAULT_SETTINGS = {
    storeName: 'BillEase POS',
    storeAddress: '',
    storePhone: '',
    gstin: '',
    defaultTaxRate: 18,
    currency: 'INR',
    thermalFooter: 'Thank you for shopping with us!'
};

export const getSettings = async (req, res, next) => {
    try {
        const data = await redisClient.get(SETTINGS_KEY);
        if (!data) {
            return res.status(200).json(DEFAULT_SETTINGS);
        }
        res.status(200).json(JSON.parse(data));
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        const currentDataRaw = await redisClient.get(SETTINGS_KEY);
        const currentData = currentDataRaw ? JSON.parse(currentDataRaw) : DEFAULT_SETTINGS;
        
        const updatedData = { ...currentData, ...req.body };
        await redisClient.set(SETTINGS_KEY, JSON.stringify(updatedData));
        
        res.status(200).json(updatedData);
    } catch (error) {
        next(error);
    }
};
