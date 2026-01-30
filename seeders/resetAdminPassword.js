/**
 * Reset super admin password
 * Run with: node seeders/resetAdminPassword.js
 */
require('dotenv').config();
const { sequelize } = require('../config/db');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const resetPassword = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL');

        // Find super admin
        const admin = await User.findOne({ where: { role: 'super_admin' } });

        if (!admin) {
            console.log('No super admin found. Creating one...');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);

            await User.create({
                name: 'Super Admin',
                email: 'admin@racephoto.com',
                password: hashedPassword,
                role: 'super_admin',
                balance: 0
            });
            console.log('Super admin created!');
        } else {
            // Reset password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);

            await User.update(
                { password: hashedPassword },
                { where: { id: admin.id }, individualHooks: false }
            );

            console.log('Password reset successfully!');
            console.log('Email:', admin.email);
            console.log('New Password: password123');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

resetPassword();
