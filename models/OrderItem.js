const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const OrderItem = sequelize.define('OrderItem', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    order_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    photo_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'photos',
            key: 'id'
        }
    },
    variant: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    // Snapshot data (matching Laravel field names)
    snap_photo_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    snap_photo_start_no: {
        type: DataTypes.STRING,
        allowNull: true
    },
    snap_event_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    snap_photo_class: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'order_items'
});

module.exports = OrderItem;
