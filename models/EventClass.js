const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EventClass = sequelize.define('EventClass', {
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
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'event_classes'
});

module.exports = EventClass;
