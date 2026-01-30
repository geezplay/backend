const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/db');

const Event = sequelize.define('Event', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    date: {
        type: DataTypes.STRING,  // Legacy date field
        allowNull: true
    },
    start_time: {
        type: DataTypes.DATE,  // Key field for auto-hide logic
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    image: {
        type: DataTypes.STRING,
        allowNull: true
    },
    category: {
        type: DataTypes.ENUM('drag', 'drift', 'rally', 'touring', 'moto', 'road_race'),
        defaultValue: 'road_race'
    },
    external_link: {
        type: DataTypes.STRING,
        allowNull: true
    },
    is_published: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    status: {
        type: DataTypes.ENUM('approved', 'pending', 'rejected'),
        defaultValue: 'approved'
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
    tableName: 'events',
    getterMethods: {
        imageUrl() {
            if (!this.image) return null;
            const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000';
            return `${baseUrl}/uploads/events/${this.image}`;
        }
    },
    scopes: {
        approved: {
            where: { status: 'approved' }
        },
        pending: {
            where: { status: 'pending' }
        },
        upcoming: {
            where: {
                start_time: { [Op.gt]: new Date() },
                is_published: true,
                status: 'approved'
            }
        }
    }
});

module.exports = Event;

