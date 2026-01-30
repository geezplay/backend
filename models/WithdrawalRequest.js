const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const WithdrawalRequest = sequelize.define('WithdrawalRequest', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    bank_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    account_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        defaultValue: 'pending'
    },
    admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    processed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    }
}, {
    tableName: 'withdrawal_requests'
});

// Instance methods
WithdrawalRequest.prototype.isPending = function () {
    return this.status === 'pending';
};

WithdrawalRequest.prototype.isApproved = function () {
    return this.status === 'approved';
};

WithdrawalRequest.prototype.isRejected = function () {
    return this.status === 'rejected';
};

module.exports = WithdrawalRequest;
