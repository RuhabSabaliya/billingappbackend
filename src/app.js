import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import metricsRoutes, { metricsMiddleware } from './utils/metrics.js';

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({ origin: '*' })); // Allow frontend proxy or direct calls
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Metrics tracing
app.use(metricsMiddleware);
app.use('/metrics', metricsRoutes);

// HTTP Request Logging
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Health Check
app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'Server is healthy' }));

import authRoutes from './modules/auth/authRoutes.js';
import productRoutes from './modules/products/productRoutes.js';
import categoryRoutes from './modules/categories/categoryRoutes.js';
import customerRoutes from './modules/customers/customerRoutes.js';
import billingRoutes from './modules/billing/billingRoutes.js';
import syncRoutes from './modules/sync/syncRoutes.js';
import reportRoutes from './modules/reports/reportRoutes.js';
import settingsRoutes from './modules/settings/settingsRoutes.js';

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/bills', billingRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Centralized Error Handling
app.use(errorHandler);

export default app;
