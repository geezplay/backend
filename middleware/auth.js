const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Generate JWT token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
};

// Protect routes - verify JWT
const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Tidak terautentikasi' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findByPk(decoded.id);

        if (!req.user) {
            return res.status(401).json({ message: 'User tidak ditemukan' });
        }

        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token tidak valid' });
    }
};

// Admin middleware
const admin = (req, res, next) => {
    if (!req.user || !req.user.isAdmin()) {
        return res.status(403).json({ message: 'Akses ditolak, hanya untuk admin' });
    }
    next();
};

// Super Admin middleware
const superAdmin = (req, res, next) => {
    if (!req.user || !req.user.isSuperAdmin()) {
        return res.status(403).json({ message: 'Akses ditolak, hanya untuk super admin' });
    }
    next();
};

module.exports = { protect, admin, superAdmin, generateToken };
