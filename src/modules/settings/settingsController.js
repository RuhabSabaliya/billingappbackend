// In-memory store for settings
let inMemorySettings = null;

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
        if (!inMemorySettings) {
            return res.status(200).json(DEFAULT_SETTINGS);
        }
        res.status(200).json(inMemorySettings);
    } catch (error) {
        next(error);
    }
};

export const updateSettings = async (req, res, next) => {
    try {
        const currentData = inMemorySettings || DEFAULT_SETTINGS;
        
        const updatedData = { ...currentData, ...req.body };
        inMemorySettings = updatedData;
        
        res.status(200).json(updatedData);
    } catch (error) {
        next(error);
    }
};
