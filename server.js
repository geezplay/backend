require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const photoRoutes = require('./routes/photos');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();

// Connect to MySQL
connectDB();

// CORS Configuration
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://gp.geezplay.site',
    'https://geezplay.site',
    'https://www.geezplay.site',
    'https://api.geezplay.site',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is in allowed list
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // In development, allow all origins
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // Reject unauthorized origins in production
        return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date(),
        uptime: process.uptime()
    });
});

// Root route - API info
app.get('/', (req, res) => {
    res.json({
        message: 'RacePhoto API Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/api/auth',
            events: '/api/events',
            photos: '/api/photos',
            orders: '/api/orders',
            payment: '/api/payment',
            admin: '/api/admin',
            health: '/health'
        }
    });
});

// API Routes - with /api prefix
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// API Routes - without /api prefix (for api.geezplay.site production)
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/photos', photoRoutes);
app.use('/orders', orderRoutes);
app.use('/payment', paymentRoutes);
app.use('/admin', adminRoutes);

// Singular aliases (backward compatibility)
app.use('/event', eventRoutes);
app.use('/photo', photoRoutes);
app.use('/order', orderRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Handle CORS errors
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'CORS policy: Origin not allowed'
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║     RacePhoto API Server Started           ║
╠════════════════════════════════════════════╣
║  Port: ${PORT}                                ║
║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(10)}                     ║
║  Time: ${new Date().toLocaleString()}       
╚════════════════════════════════════════════╝
    `);
});
