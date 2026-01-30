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

// Middleware
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://gp.geezplay.site',
    'https://api.geezplay.site',
    process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all origins in production for flexibility
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes (with /api prefix)
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// API Routes (without /api prefix for api.geezplay.site)
app.use('/auth', authRoutes);
app.use('/events', eventRoutes);
app.use('/photos', photoRoutes);
app.use('/orders', orderRoutes);
app.use('/payment', paymentRoutes);
app.use('/admin', adminRoutes);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'RacePhoto API Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: '/auth or /api/auth',
            events: '/events or /api/events',
            photos: '/photos or /api/photos',
            orders: '/orders or /api/orders',
            payment: '/payment or /api/payment',
            admin: '/admin or /api/admin',
            health: '/health or /api/health'
        }
    });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
