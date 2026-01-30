// Seed script to create admin user - Fixed version
require('dotenv').config();
const { sequelize } = require('./config/db');
const { User } = require('./models');

const seedAdmin = async () => {
    try {
        // Connect to database
        await sequelize.authenticate();
        console.log('Connected to database');

        // Delete existing admin if exists
        await User.destroy({ where: { email: 'admin@racephoto.com' } });
        console.log('Removed existing admin (if any)');

        // Create admin user - password will be hashed by model hook automatically
        const admin = await User.create({
            name: 'Super Admin',
            email: 'admin@racephoto.com',
            password: 'admin123',  // Will be hashed by beforeCreate hook
            role: 'super_admin'
        });

        console.log('=================================');
        console.log('Admin user created successfully!');
        console.log('=================================');
        console.log('Email: admin@racephoto.com');
        console.log('Password: admin123');
        console.log('Role: super_admin');
        console.log('User ID:', admin.id);
        console.log('=================================');

        process.exit(0);
    } catch (error) {
        console.error('Error seeding admin:', error);
        process.exit(1);
    }
};

seedAdmin();
