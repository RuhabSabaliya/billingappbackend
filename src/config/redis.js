import Redis from 'ioredis';
import { ENV } from './env.js';
import { logger } from '../utils/logger.js';

export const redisClient = new Redis(ENV.REDIS_URL, {
    maxRetriesPerRequest: null, // Critical for BullMQ
});

redisClient.on('connect', () => logger.info('Redis Client Connected'));
redisClient.on('error', (err) => logger.error('Redis Client Error', err));

export default redisClient;
