const express = require('express');
const { Op } = require('sequelize');
const { Photo, Event, RecapPhoto } = require('../models');

const router = express.Router();

// @route   GET /api/photos/event/:eventId/class/:className
// @desc    Get photos by event and class
router.get('/event/:eventId/class/:className', async (req, res) => {
    try {
        const { eventId, className } = req.params;
        const { startNo, page = 1, limit = 50 } = req.query;

        const event = await Event.findByPk(eventId);
        if (!event || event.status !== 'approved') {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Build where clause
        const where = {
            event_id: eventId,
            class: decodeURIComponent(className)
        };

        if (startNo) {
            where.start_no = { [Op.like]: `%${startNo}%` };
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);

        const photos = await Photo.findAll({
            where,
            include: [{
                model: RecapPhoto,
                as: 'recaps'
            }],
            limit: parseInt(limit),
            offset,
            order: [['start_no', 'ASC']]
        });

        // Get unique start numbers
        const allPhotos = await Photo.findAll({
            where: { event_id: eventId, class: decodeURIComponent(className) },
            attributes: ['start_no'],
            group: ['start_no'],
            order: [['start_no', 'ASC']]
        });
        const startNumbers = allPhotos.map(p => p.start_no);

        const photosWithDetails = photos.map(p => ({
            ...p.toJSON(),
            startNo: p.start_no,
            price: parseFloat(p.price),
            photoUrl: p.photoUrl,
            recapCount: p.recaps?.length || 0,
            eventId: { name: event.name }
        }));

        res.json({
            photos: photosWithDetails,
            event: { ...event.toJSON(), imageUrl: event.imageUrl },
            startNumbers
        });
    } catch (error) {
        console.error('Get photos error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/photos/:id
// @desc    Get single photo
router.get('/:id', async (req, res) => {
    try {
        const photo = await Photo.findByPk(req.params.id, {
            include: [
                { model: Event, as: 'event' },
                { model: RecapPhoto, as: 'recaps' }
            ]
        });

        if (!photo) {
            return res.status(404).json({ message: 'Photo not found' });
        }

        // Build recaps with full URLs
        const recapsWithUrls = (photo.recaps || []).map(r => ({
            id: r.id,
            variant_number: r.variant_number,
            url: r.url // Uses the getter from model which returns full URL
        }));

        res.json({
            ...photo.toJSON(),
            startNo: photo.start_no,
            price: parseFloat(photo.price),
            photoUrl: photo.photoUrl,
            recapCount: photo.recaps?.length || 0,
            recaps: recapsWithUrls
        });
    } catch (error) {
        console.error('Get photo error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/photos/download/:type/:id
// @desc    Download photo or recap (forces download)
router.get('/download/:type/:id', async (req, res) => {
    try {
        const { type, id } = req.params;
        const path = require('path');
        const fs = require('fs');

        let filePath;
        let filename;

        if (type === 'recap') {
            const recap = await RecapPhoto.findByPk(id);
            if (!recap) {
                return res.status(404).json({ message: 'Recap not found' });
            }
            // Get raw file path from database
            const rawPath = recap.getDataValue('url');
            filePath = path.join(__dirname, '..', rawPath);
            filename = `recap-v${recap.variant_number}-${id}.jpg`;
        } else if (type === 'photo') {
            const photo = await Photo.findByPk(id);
            if (!photo) {
                return res.status(404).json({ message: 'Photo not found' });
            }
            const rawPath = photo.getDataValue('url');
            filePath = path.join(__dirname, '..', rawPath);
            filename = `photo-${photo.start_no}-${id}.jpg`;
        } else {
            return res.status(400).json({ message: 'Invalid type' });
        }

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            return res.status(404).json({ message: 'File not found' });
        }

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'image/jpeg');

        // Send file
        res.sendFile(filePath);
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Download failed' });
    }
});

// @route   GET /api/photos/download-by-order/:orderId/:itemIndex
// @desc    Download photo for a specific order item
router.get('/download-by-order/:orderId/:itemIndex', async (req, res) => {
    try {
        const { orderId, itemIndex } = req.params;
        const path = require('path');
        const fs = require('fs');

        // Import from central models index with associations
        const { Order, OrderItem } = require('../models');

        console.log(`Download request: orderId=${orderId}, itemIndex=${itemIndex}`);

        const order = await Order.findByPk(orderId, {
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Photo,
                    as: 'photo',
                    include: [{
                        model: RecapPhoto,
                        as: 'recaps'
                    }]
                }]
            }]
        });

        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({ message: 'Order not found' });
        }

        console.log('Order status:', order.status);
        console.log('Order items count:', order.items?.length);

        // Check if order is paid
        if (order.status !== 'success') {
            return res.status(403).json({ message: 'Payment not completed' });
        }

        const item = order.items[parseInt(itemIndex)];
        if (!item) {
            console.log('Item not found at index:', itemIndex);
            return res.status(404).json({ message: 'Item not found' });
        }

        console.log('Item photo:', item.photo?.id);
        console.log('Item variant:', item.variant);
        console.log('Item photo recaps:', item.photo?.recaps?.length);

        // Find the recap matching the variant
        const recapPhoto = item.photo?.recaps?.find(r => r.variant_number === item.variant);
        console.log('Found recap photo:', recapPhoto?.id);

        let filePath;
        let filename;

        if (recapPhoto) {
            // RecapPhoto stores just filename in 'file_path' field
            const rawPath = recapPhoto.getDataValue('file_path');
            console.log('Recap file_path:', rawPath);
            filePath = path.join(__dirname, '..', 'uploads', 'recaps', rawPath);
            filename = `foto-${item.snap_photo_start_no || item.photo_id}-v${item.variant}.jpg`;
        } else if (item.photo) {
            // Photo stores full path like '/uploads/photos/filename.jpg' in 'url' field
            const rawPath = item.photo.getDataValue('url');
            console.log('Photo url:', rawPath);
            filePath = path.join(__dirname, '..', rawPath);
            filename = `foto-${item.snap_photo_start_no || item.photo_id}.jpg`;
        } else {
            console.log('No photo found for item');
            return res.status(404).json({ message: 'Photo file not found' });
        }

        console.log('File path:', filePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found on filesystem:', filePath);
            return res.status(404).json({ message: 'File not found on server' });
        }

        // Set headers for download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'image/jpeg');

        // Send file
        res.sendFile(filePath, (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
        });
    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ message: 'Download failed', error: error.message });
    }
});

module.exports = router;
