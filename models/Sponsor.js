const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Sponsor = sequelize.define('Sponsor', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    logo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    tableName: 'sponsors',
    getterMethods: {
        logoUrl() {
            if (!this.logo) return null;
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return `${baseUrl}/uploads/sponsors/${this.logo}`;
        }
    }
});

module.exports = Sponsor;
