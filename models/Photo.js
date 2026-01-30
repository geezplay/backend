const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Photo = sequelize.define('Photo', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    event_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'events',
            key: 'id'
        }
    },
    class: {
        type: DataTypes.STRING,
        allowNull: false
    },
    start_no: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    url: {
        type: DataTypes.STRING,
        allowNull: false
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'photos',
    getterMethods: {
        photoUrl() {
            if (!this.url) return null;
            // If url already starts with http, return as is
            if (this.url.startsWith('http')) return this.url;
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            // If url starts with /, prepend base URL
            return `${baseUrl}${this.url}`;
        }
    }
});

module.exports = Photo;
