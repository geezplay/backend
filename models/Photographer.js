const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Photographer = sequelize.define('Photographer', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    team: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.STRING,
        allowNull: true
    },
    photo: {
        type: DataTypes.STRING,
        allowNull: true
    },
    gradient_from: {
        type: DataTypes.STRING(7),
        defaultValue: '#667eea'
    },
    gradient_to: {
        type: DataTypes.STRING(7),
        defaultValue: '#764ba2'
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'photographers',
    getterMethods: {
        photoUrl() {
            if (!this.photo) return null;
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return `${baseUrl}/uploads/photographers/${this.photo}`;
        }
    },
    scopes: {
        active: {
            where: { is_active: true }
        }
    }
});

module.exports = Photographer;
