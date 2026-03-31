import client from 'prom-client';
import express from 'express';

// Create a Registry
const register = new client.Registry();

// Enable standard NodeJS metrics (CPU, RAM, Event Loop Lag)
client.collectDefaultMetrics({ register });

// Custom Metric: HTTP Response Time
export const httpRequestDurationMicroseconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in microseconds',
    labelNames: ['method', 'route', 'code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});
register.registerMetric(httpRequestDurationMicroseconds);

// Custom Metric: Active WebSockets
export const activeWebSocketsGauge = new client.Gauge({
    name: 'active_websocket_connections',
    help: 'Number of currently active POS cashier WebSocket connections'
});
register.registerMetric(activeWebSocketsGauge);

const router = express.Router();

// The /metrics endpoint for Prometheus to scrape
router.get('/', async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (err) {
        res.status(500).end(err);
    }
});

// Middleware to automatically capture HTTP latencies for every route
export const metricsMiddleware = (req, res, next) => {
    const end = httpRequestDurationMicroseconds.startTimer();
    res.on('finish', () => {
        end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
    });
    next();
};

export default router;
