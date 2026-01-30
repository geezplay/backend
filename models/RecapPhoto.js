const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const RecapPhoto = sequelize.define('RecapPhoto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    photo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'photos',
            key: 'id'
        }
    },
    variant_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
    file_path: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'recap_photos',
    indexes: [
        {
            unique: true,
            fields: ['photo_id', 'variant_number']
        }
    ],
    getterMethods: {
        url() {
            if (!this.file_path) return null;
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return `${baseUrl}/uploads/recaps/${this.file_path}`;
        }
    }
});

module.exports = RecapPhoto;
