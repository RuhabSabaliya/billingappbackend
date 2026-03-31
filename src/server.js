import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { ENV, validateEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { setIO } from './realtime/io.js';

// Validate environment variables before boot
validateEnv();

const server = http.createServer(app);

// Initialize Socket.io
export const io = new Server(server, {
    cors: { origin: '*' }
});

setIO(io);

io.on('connection', (socket) => {
    logger.info(`New WebSocket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
    });
});

// Start listening
server.listen(ENV.PORT, () => {
    logger.info(`[BillEase Backend] Server running in ${ENV.NODE_ENV} mode on port ${ENV.PORT}`);
});

// Graceful Shutdown on SIGINT and SIGTERM
const shutdown = () => {
    logger.info('SIGTERM/SIGINT received. Shutting down gracefully...');

    server.close(() => {
        logger.info('HTTP server closed.');
        // TODO: Disconnect Prisma and Redis here
        process.exit(0);
    });

    // Force close after 10s if dangling connections persist
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
