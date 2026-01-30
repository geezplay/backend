const express = require('express');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { protect, generateToken } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/auth
// @desc    Get auth endpoints info
router.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Auth API',
        endpoints: {
            login: 'POST /auth/login',
            logout: 'POST /auth/logout',
            me: 'GET /auth/me (requires token)'
        }
    });
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check for user
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: 'Email atau password salah' });
        }

        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Email atau password salah' });
        }

        // Check if user is admin
        if (!user.isAdmin()) {
            return res.status(403).json({ message: 'Akses ditolak' });
        }

        // Generate token
        const token = generateToken(user.id);

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                balance: parseFloat(user.balance)
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
router.post('/logout', (req, res) => {
    res.json({ message: 'Logged out successfully' });
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', protect, async (req, res) => {
    try {
        res.json({
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            balance: parseFloat(req.user.balance)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
