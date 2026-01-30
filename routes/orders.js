const express = require('express');
const { sequelize } = require('../config/db');
const { Order, OrderItem, Photo, Event } = require('../models');

const router = express.Router();

// @route   POST /api/orders
// @desc    Create new order
router.post('/', async (req, res) => {
    const t = await sequelize.transaction();

    try {
        const { email, whatsapp, items } = req.body;

        if (!items || items.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'Cart is empty' });
        }

        // Calculate total and prepare items
        let totalPrice = 0;
        const orderItems = [];

        for (const item of items) {
            const photo = await Photo.findByPk(item.photoId, {
                include: [{ model: Event, as: 'event' }],
                transaction: t
            });

            if (!photo) continue;

            const price = parseInt(photo.price);
            totalPrice += price;

            orderItems.push({
                photo_id: photo.id,
                variant: item.variant || 1,
                price: price,
                snap_photo_start_no: photo.start_no,
                snap_photo_url: photo.url,
                snap_event_name: photo.event?.name || '',
                snap_photo_class: photo.class || ''
            });
        }

        // Create order
        const order = await Order.create({
            email,
            whatsapp: whatsapp || '',
            total_price: totalPrice,
            status: 'pending'
        }, { transaction: t });

        // Create order items
        for (const item of orderItems) {
            await OrderItem.create({
                ...item,
                order_id: order.id
            }, { transaction: t });
        }

        await t.commit();

        res.status(201).json({
            _id: order.id,
            id: order.id,
            orderId: order.id,
            order_id: order.id,
            email: order.email,
            totalPrice: order.total_price,
            status: order.status
        });
    } catch (error) {
        await t.rollback();
        console.error('Create order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/orders/:id
// @desc    Get order by ID
router.get('/:id', async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Photo,
                    as: 'photo',
                    include: [{
                        model: require('../models/RecapPhoto'),
                        as: 'recaps'
                    }]
                }]
            }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Helper function to construct full URL
        const getFullUrl = (path) => {
            if (!path) return null;
            if (path.startsWith('http')) return path;
            return path; // Return as-is, frontend will add base URL
        };

        res.json({
            _id: order.id,
            id: order.id,
            email: order.email,
            whatsapp: order.whatsapp,
            totalPrice: order.total_price,
            status: order.status,
            items: order.items?.map(item => {
                // Find the recap photo matching the variant
                const recapPhoto = item.photo?.recaps?.find(r => r.variant_number === item.variant);

                // Get the photo URL - use snap_photo_url from order item (snapshot at purchase time)
                const photoUrl = item.snap_photo_url || item.photo?.url;

                // Get recap URL if exists
                let recapUrl = null;
                if (recapPhoto) {
                    recapUrl = `/uploads/recaps/${recapPhoto.file_path}`;
                }

                return {
                    id: item.id,
                    photoId: item.photo_id,
                    variant: item.variant,
                    price: item.price,
                    startNo: item.snap_photo_start_no,
                    photoUrl: photoUrl,
                    eventName: item.snap_event_name,
                    recapUrl: recapUrl,
                    mainPhotoUrl: photoUrl
                };
            }),
            createdAt: order.created_at
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/orders/:id/status
// @desc    Update order status
router.put('/:id/status', async (req, res) => {
    try {
        const { status } = req.body;
        const order = await Order.findByPk(req.params.id, {
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Photo,
                    as: 'photo',
                    attributes: ['id', 'created_by']
                }]
            }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const previousStatus = order.status;
        order.status = status;
        await order.save();

        // Update photo owner's balance when status changes to success
        if (status === 'success' && previousStatus !== 'success') {
            try {
                const { User } = require('../models');

                // Group earnings by photo owner
                const ownerEarnings = {};
                for (const item of order.items) {
                    const ownerId = item.photo?.created_by;
                    if (ownerId) {
                        if (!ownerEarnings[ownerId]) {
                            ownerEarnings[ownerId] = 0;
                        }
                        ownerEarnings[ownerId] += parseFloat(item.price);
                    }
                }

                // Update each owner's balance
                for (const [ownerId, earnings] of Object.entries(ownerEarnings)) {
                    const owner = await User.findByPk(ownerId);
                    if (owner) {
                        const currentBalance = parseFloat(owner.balance) || 0;
                        owner.balance = currentBalance + earnings;
                        await owner.save();
                        console.log(`Updated balance for user ${ownerId}: +${earnings} (new balance: ${owner.balance})`);
                    }
                }
            } catch (balanceError) {
                console.error('Failed to update balance:', balanceError);
                // Don't fail the request if balance update fails
            }

            // Send email
            try {
                const { sendTransactionEmail } = require('../services/emailService');
                const result = await sendTransactionEmail(order, order.items);
                console.log('Email result:', result);
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
                // Don't fail the request if email fails
            }
        }

        res.json({ message: 'Status updated', status: order.status });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/orders/:id/send-email
// @desc    Manually send/resend transaction email
router.post('/:id/send-email', async (req, res) => {
    try {
        const order = await Order.findByPk(req.params.id, {
            include: [{ model: OrderItem, as: 'items' }]
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        if (order.status !== 'success') {
            return res.status(400).json({ message: 'Order payment not completed' });
        }

        const { sendTransactionEmail } = require('../services/emailService');
        const result = await sendTransactionEmail(order, order.items);

        if (result.success) {
            res.json({ message: 'Email sent successfully', messageId: result.messageId });
        } else {
            res.status(500).json({ message: 'Failed to send email', error: result.error });
        }
    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

