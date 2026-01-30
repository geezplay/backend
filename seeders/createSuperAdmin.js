/**
 * Seeder script to create initial super admin user
 * Run with: node seeders/createSuperAdmin.js
 */
require('dotenv').config();
const { sequelize } = require('../config/db');
const { User } = require('../models');

const createSuperAdmin = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to MySQL');

        // Sync models
        await sequelize.sync();

        // Check if super admin exists
        const existingAdmin = await User.findOne({ where: { role: 'super_admin' } });

        if (existingAdmin) {
            console.log('Super admin already exists:', existingAdmin.email);
            process.exit(0);
        }

        // Create super admin
        const superAdmin = await User.create({
            name: 'Super Admin',
            email: 'admin@racephoto.com',
            password: 'password123',
            role: 'super_admin',
            balance: 0
        });

        console.log('Super admin created successfully!');
        console.log('Email:', superAdmin.email);
        console.log('Password: password123');
        console.log('\n⚠️  Please change the password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
};

createSuperAdmin();
