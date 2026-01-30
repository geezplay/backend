const express = require('express');
const { snap, coreApi } = require('../config/midtrans');
const { Order, OrderItem, Photo, User, Event } = require('../models');
const { sequelize } = require('../config/db');

const router = express.Router();

// @route   GET /api/payment
// @desc    Get payment API info
router.get('/', (req, res) => {
    res.json({
        message: 'Payment API',
        endpoints: [
            { method: 'POST', path: '/create-token', description: 'Create Midtrans payment token' },
            { method: 'POST', path: '/notification', description: 'Handle Midtrans webhook' }
        ]
    });
});

// @route   GET /api/payment/create-token
// @desc    Info for create-token endpoint
router.get('/create-token', (req, res) => {
    res.json({
        message: 'This endpoint requires POST method',
        method: 'POST',
        body: {
            orderId: 'number (required) - Order ID to create payment for'
        },
        response: {
            token: 'string - Midtrans Snap token',
            redirectUrl: 'string - Payment redirect URL'
        }
    });
});

// @route   POST /api/payment/create-token
// @desc    Create Midtrans Snap token
router.post('/create-token', async (req, res) => {
    try {
        const { orderId } = req.body;

        const order = await Order.findByPk(orderId, {
            include: [{ model: OrderItem, as: 'items' }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const parameter = {
            transaction_details: {
                order_id: `RACEPHOTO-${order.id}-${Date.now()}`,
                gross_amount: parseInt(order.total_price)
            },
            customer_details: {
                email: order.email,
                phone: order.whatsapp || ''
            },
            item_details: order.items.map(item => ({
                id: item.id.toString(),
                price: parseInt(item.price),
                quantity: 1,
                name: `Foto #${item.snapshot_start_no || 'N/A'}`
            }))
        };

        const token = await snap.createTransaction(parameter);

        // Save snap token to order
        order.snap_token = token.token;
        await order.save();

        res.json({
            token: token.token,
            snap_token: token.token,
            snapToken: token.token,
            redirectUrl: token.redirect_url
        });
    } catch (error) {
        console.error('Create token error:', error);
        res.status(500).json({ message: 'Failed to create payment token' });
    }
});

// @route   POST /api/payment/notification
// @desc    Handle Midtrans webhook notification
router.post('/notification', async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const notification = req.body;
        const statusResponse = await coreApi.transaction.notification(notification);

        const orderId = statusResponse.order_id;
        const transactionStatus = statusResponse.transaction_status;
        const fraudStatus = statusResponse.fraud_status;

        // Extract original order ID from pattern RACEPHOTO-{id}-{timestamp}
        const orderIdMatch = orderId.match(/RACEPHOTO-(\d+)-/);
        if (!orderIdMatch) {
            await t.rollback();
            return res.status(400).json({ message: 'Invalid order ID format' });
        }
        const realOrderId = orderIdMatch[1];

        const order = await Order.findByPk(realOrderId, {
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Photo,
                    as: 'photo',
                    include: [{ model: Event, as: 'event' }]
                }]
            }],
            transaction: t
        });

        if (!order) {
            await t.rollback();
            return res.status(404).json({ message: 'Order not found' });
        }

        let newStatus = order.status;

        if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
            if (fraudStatus === 'accept' || !fraudStatus) {
                newStatus = 'success';

                // Add to admin balance for each photo
                for (const item of order.items) {
                    if (item.photo?.event?.created_by) {
                        await User.increment('balance', {
                            by: parseFloat(item.price),
                            where: { id: item.photo.event.created_by },
                            transaction: t
                        });
                    }
                }
            }
        } else if (transactionStatus === 'deny' || transactionStatus === 'cancel' || transactionStatus === 'expire') {
            newStatus = 'failed';
        } else if (transactionStatus === 'pending') {
            newStatus = 'pending';
        }

        order.status = newStatus;
        await order.save({ transaction: t });
        await t.commit();

        res.json({ message: 'OK' });
    } catch (error) {
        await t.rollback();
        console.error('Notification error:', error);
        res.status(500).json({ message: 'Failed to process notification' });
    }
});

module.exports = router;
