const express = require('express');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const {
    User, Event, EventClass, Photo, RecapPhoto,
    Order, OrderItem, Sponsor, Photographer,
    WithdrawalRequest, SiteSetting
} = require('../models');
const { protect, admin, superAdmin } = require('../middleware/auth');
const {
    uploadEvent, uploadPhoto, uploadRecap,
    uploadSponsor, uploadPhotographer, uploadSettings
} = require('../middleware/upload');

const router = express.Router();

// Apply auth middleware to all routes
router.use(protect);
router.use(admin);

// ==================== DASHBOARD ====================

// @route   GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const isSuperAdmin = req.user.isSuperAdmin();
        const userId = req.user.id;

        // Get stats
        let eventWhere = isSuperAdmin ? {} : { created_by: userId };
        const totalEvents = await Event.count({ where: eventWhere });

        // For photos, filter by created_by instead of event ownership
        let photoWhere = isSuperAdmin ? {} : { created_by: userId };
        const totalPhotos = await Photo.count({ where: photoWhere });

        // Calculate revenue and orders based on admin's photos
        let totalOrders = 0;
        let totalRevenue = 0;

        if (isSuperAdmin) {
            // Super Admin sees all stats
            totalOrders = await Order.count({ where: { status: 'success' } });
            const revenueResult = await Order.sum('total_price', { where: { status: 'success' } });
            totalRevenue = revenueResult || 0;
        } else {
            // Regular admin: calculate from order items where photo.created_by === userId
            const adminOrderItems = await OrderItem.findAll({
                include: [{
                    model: Photo,
                    as: 'photo',
                    where: { created_by: userId },
                    attributes: ['id', 'created_by']
                }, {
                    model: Order,
                    as: 'order',
                    where: { status: 'success' },
                    attributes: ['id']
                }],
                attributes: ['id', 'price']
            });

            // Sum prices from order items
            totalRevenue = adminOrderItems.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
            // Count unique orders
            const uniqueOrderIds = new Set(adminOrderItems.map(item => item.order?.id).filter(Boolean));
            totalOrders = uniqueOrderIds.size;
        }

        // User balance
        const userBalance = parseFloat(req.user.balance);

        // Storage used (approximate)
        let storageUsed = 0;
        const uploadsDir = path.join(__dirname, '../uploads');
        if (fs.existsSync(uploadsDir)) {
            const getSize = (dir) => {
                let size = 0;
                try {
                    const files = fs.readdirSync(dir);
                    files.forEach(file => {
                        const filePath = path.join(dir, file);
                        const stats = fs.statSync(filePath);
                        if (stats.isDirectory()) {
                            size += getSize(filePath);
                        } else {
                            size += stats.size;
                        }
                    });
                } catch (e) { }
                return size;
            };
            storageUsed = getSize(uploadsDir);
        }

        // Recent orders
        const recentOrders = await Order.findAll({
            include: [{ model: OrderItem, as: 'items' }],
            order: [['created_at', 'DESC']],
            limit: 5
        });

        res.json({
            totalEvents,
            totalPhotos,
            totalOrders,
            totalRevenue: parseFloat(totalRevenue),
            userBalance,
            storageUsed,
            recentOrders: recentOrders.map(o => ({
                _id: o.id,
                email: o.email,
                totalPrice: parseFloat(o.total_price),
                status: o.status,
                items: o.items,
                createdAt: o.created_at
            }))
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// ==================== TRANSACTIONS ====================

// @route   GET /api/admin/transactions
router.get('/transactions', async (req, res) => {
    try {
        const { status, event, className, page = 1, limit = 20 } = req.query;
        const isSuperAdmin = req.user.isSuperAdmin();

        // Build query based on role
        const where = {};
        if (status) where.status = status;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Include Photo model with Event and Creator info
        const orders = await Order.findAll({
            where,
            attributes: ['id', 'email', 'whatsapp', 'total_price', 'status', 'snap_token', 'created_at', 'updated_at'],
            include: [{
                model: OrderItem,
                as: 'items',
                include: [{
                    model: Photo,
                    as: 'photo',
                    attributes: ['id', 'start_no', 'class', 'price', 'url', 'created_by', 'event_id'],
                    include: [
                        { model: Event, as: 'event', attributes: ['id', 'name'] },
                        { model: User, as: 'creator', attributes: ['id', 'name', 'email'] }
                    ]
                }]
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset
        });

        // Filter orders based on role
        let filteredOrders = orders;
        if (!isSuperAdmin) {
            // Regular admin: only show orders that contain at least one photo they own
            filteredOrders = orders.filter(order => {
                if (!order.items || order.items.length === 0) return false;
                return order.items.some(item => item.photo && item.photo.created_by === req.user.id);
            }).map(order => {
                // Also filter items to only show their photos
                const filteredItems = order.items.filter(item =>
                    item.photo && item.photo.created_by === req.user.id
                );
                return {
                    ...order.toJSON(),
                    items: filteredItems
                };
            });
        }

        // Apply event and class filters
        let result = filteredOrders.map(o => {
            const orderData = o.toJSON ? o.toJSON() : o;
            return {
                id: orderData.id,
                _id: orderData.id,
                email: orderData.email,
                whatsapp: orderData.whatsapp,
                totalPrice: parseFloat(orderData.total_price),
                total_price: parseFloat(orderData.total_price),
                status: orderData.status,
                items: (orderData.items || []).map(item => ({
                    id: item.id,
                    variant: item.variant,
                    price: item.price,
                    snap_photo_url: item.snap_photo_url,
                    snap_photo_start_no: item.snap_photo_start_no,
                    snap_event_name: item.snap_event_name,
                    snap_photo_class: item.snap_photo_class,
                    photo: item.photo ? {
                        id: item.photo.id,
                        start_no: item.photo.start_no,
                        class: item.photo.class,
                        url: item.photo.url,
                        event_name: item.photo.event?.name || null,
                        event_id: item.photo.event_id,
                        creator_name: item.photo.creator?.name || null,
                        creator_email: item.photo.creator?.email || null
                    } : null
                })),
                createdAt: orderData.created_at,
                created_at: orderData.created_at
            };
        });

        // Apply filters if provided
        if (event) {
            result = result.filter(order =>
                order.items.some(item =>
                    (item.snap_event_name && item.snap_event_name.toLowerCase().includes(event.toLowerCase())) ||
                    (item.photo?.event_name && item.photo.event_name.toLowerCase().includes(event.toLowerCase()))
                )
            );
        }

        if (className) {
            result = result.filter(order =>
                order.items.some(item =>
                    (item.snap_photo_class && item.snap_photo_class.toLowerCase().includes(className.toLowerCase())) ||
                    (item.photo?.class && item.photo.class.toLowerCase().includes(className.toLowerCase()))
                )
            );
        }

        // Get unique events and classes for filter options
        const allEvents = new Set();
        const allClasses = new Set();
        result.forEach(order => {
            order.items.forEach(item => {
                if (item.snap_event_name) allEvents.add(item.snap_event_name);
                if (item.photo?.event_name) allEvents.add(item.photo.event_name);
                if (item.snap_photo_class) allClasses.add(item.snap_photo_class);
                if (item.photo?.class) allClasses.add(item.photo.class);
            });
        });

        res.json({
            orders: result,
            filters: {
                events: Array.from(allEvents).filter(Boolean),
                classes: Array.from(allClasses).filter(Boolean)
            }
        });
    } catch (error) {
        console.error('Transactions error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== EVENTS ====================

// @route   GET /api/admin/events
router.get('/events', async (req, res) => {
    try {
        const where = req.user.isSuperAdmin() ? {} : { created_by: req.user.id };

        const events = await Event.findAll({
            where,
            include: [
                { model: EventClass, as: 'classes' },
                { model: User, as: 'creator', attributes: ['id', 'name'] }
            ],
            order: [['date', 'DESC']]
        });

        res.json(events.map(e => ({
            ...e.toJSON(),
            _id: e.id,
            imageUrl: e.imageUrl
        })));
    } catch (error) {
        console.error('Get events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/events/all/approved
// Get all approved events (for photo upload - any admin can upload to any approved event)
router.get('/events/all/approved', async (req, res) => {
    try {
        const events = await Event.findAll({
            where: { status: 'approved' },
            include: [
                { model: EventClass, as: 'classes' },
                { model: User, as: 'creator', attributes: ['id', 'name'] }
            ],
            order: [['date', 'DESC']]
        });

        res.json(events.map(e => ({
            ...e.toJSON(),
            _id: e.id,
            imageUrl: e.imageUrl
        })));
    } catch (error) {
        console.error('Get approved events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/events/:id
router.get('/events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id, {
            include: [{ model: EventClass, as: 'classes' }]
        });

        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }

        // Allow viewing approved events for any admin (needed for class selection)
        // But only owner or super admin can edit non-approved events
        if (!req.user.isSuperAdmin() && event.created_by !== req.user.id && event.status !== 'approved') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ ...event.toJSON(), _id: event.id, imageUrl: event.imageUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/events
router.post('/events', uploadEvent.single('image'), async (req, res) => {
    try {
        const { name, date, location } = req.body;

        const event = await Event.create({
            name,
            date,
            location,
            image: req.file?.filename || null,
            status: req.user.isSuperAdmin() ? 'approved' : 'pending',
            created_by: req.user.id
        });

        res.status(201).json({ ...event.toJSON(), _id: event.id, imageUrl: event.imageUrl });
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/events/:id
router.put('/events/:id', uploadEvent.single('image'), async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (!req.user.isSuperAdmin() && event.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { name, date, location } = req.body;
        event.name = name || event.name;
        event.date = date || event.date;
        event.location = location || event.location;
        if (req.file) event.image = req.file.filename;

        await event.save();
        res.json({ ...event.toJSON(), _id: event.id, imageUrl: event.imageUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/events/:id
router.delete('/events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        if (!req.user.isSuperAdmin() && event.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await event.destroy();
        res.json({ message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== CLASSES ====================

// @route   POST /api/admin/events/:eventId/classes
router.post('/events/:eventId/classes', async (req, res) => {
    try {
        const { name } = req.body;
        const eventClass = await EventClass.create({
            event_id: req.params.eventId,
            name
        });
        res.status(201).json({ ...eventClass.toJSON(), _id: eventClass.id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/classes/:id
router.delete('/classes/:id', async (req, res) => {
    try {
        await EventClass.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Class deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== PHOTOS ====================

// @route   GET /api/admin/photos
router.get('/photos', async (req, res) => {
    try {
        // Filter by created_by for regular admins
        const where = req.user.isSuperAdmin() ? {} : { created_by: req.user.id };

        const photos = await Photo.findAll({
            where,
            include: [
                { model: Event, as: 'event' },
                { model: RecapPhoto, as: 'recaps' }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(photos.map(p => ({
            ...p.toJSON(),
            _id: p.id,
            startNo: p.start_no,
            price: parseFloat(p.price),
            photoUrl: p.photoUrl,
            event_name: p.event?.name,
            class: p.class,
            recap_count: p.recaps?.length || 0
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/photos/:id
router.get('/photos/:id', async (req, res) => {
    try {
        const photo = await Photo.findByPk(req.params.id, {
            include: [
                { model: Event, as: 'event' },
                { model: RecapPhoto, as: 'recaps' }
            ]
        });
        if (!photo) return res.status(404).json({ message: 'Photo not found' });

        // Check ownership for regular admins
        if (!req.user.isSuperAdmin() && photo.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json({ ...photo.toJSON(), _id: photo.id, startNo: photo.start_no, price: parseFloat(photo.price), photoUrl: photo.photoUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/photos
router.post('/photos', uploadPhoto.single('photo'), async (req, res) => {
    try {
        const { eventId, class: photoClass, startNo, price } = req.body;

        if (!req.file) return res.status(400).json({ message: 'Photo file required' });

        const photo = await Photo.create({
            event_id: eventId,
            class: photoClass,
            start_no: startNo,
            price,
            url: `/uploads/photos/${req.file.filename}`,
            created_by: req.user.id
        });

        res.status(201).json({ ...photo.toJSON(), _id: photo.id, photoUrl: photo.photoUrl });
    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/photos/:id
router.put('/photos/:id', uploadPhoto.single('photo'), async (req, res) => {
    try {
        const photo = await Photo.findByPk(req.params.id);
        if (!photo) return res.status(404).json({ message: 'Photo not found' });

        // Check ownership for regular admins
        if (!req.user.isSuperAdmin() && photo.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { eventId, class: photoClass, startNo, price } = req.body;
        if (eventId) photo.event_id = eventId;
        if (photoClass) photo.class = photoClass;
        if (startNo) photo.start_no = startNo;
        if (price) photo.price = price;
        if (req.file) photo.url = `/uploads/photos/${req.file.filename}`;

        await photo.save();
        res.json({ ...photo.toJSON(), _id: photo.id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/photos/:id
router.delete('/photos/:id', async (req, res) => {
    try {
        const photo = await Photo.findByPk(req.params.id);
        if (!photo) return res.status(404).json({ message: 'Photo not found' });

        // Check ownership for regular admins
        if (!req.user.isSuperAdmin() && photo.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await photo.destroy();
        res.json({ message: 'Photo deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== RECAPS (Owner or Super Admin) ====================

// @route   POST /api/admin/photos/:photoId/recaps
// Allow photo owner OR super admin to upload recaps
router.post('/photos/:photoId/recaps', uploadRecap.array('recaps', 10), async (req, res) => {
    try {
        // Check if photo exists and user has permission
        const photo = await Photo.findByPk(req.params.photoId);
        if (!photo) return res.status(404).json({ message: 'Photo not found' });

        // Only photo owner or super admin can upload recaps
        if (!req.user.isSuperAdmin() && photo.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied. Only photo owner can upload recaps.' });
        }

        const recaps = [];
        for (const file of req.files) {
            const recap = await RecapPhoto.create({
                photo_id: req.params.photoId,
                file_path: file.filename,
                variant_number: recaps.length + 1
            });
            recaps.push(recap);
        }
        res.status(201).json(recaps);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/recaps/:id
// Allow photo owner OR super admin to delete recaps
router.delete('/recaps/:id', async (req, res) => {
    try {
        const recap = await RecapPhoto.findByPk(req.params.id, {
            include: [{ model: Photo, as: 'photo', attributes: ['id', 'created_by'] }]
        });
        if (!recap) return res.status(404).json({ message: 'Recap not found' });

        // Only photo owner or super admin can delete recaps
        if (!req.user.isSuperAdmin() && recap.photo?.created_by !== req.user.id) {
            return res.status(403).json({ message: 'Access denied' });
        }

        await recap.destroy();
        res.json({ message: 'Recap deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== PENDING EVENTS (Super Admin) ====================

// @route   GET /api/admin/pending-events
router.get('/pending-events', superAdmin, async (req, res) => {
    try {
        const events = await Event.findAll({
            where: { status: 'pending' },
            include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }],
            order: [['created_at', 'ASC']]
        });
        res.json(events.map(e => ({ ...e.toJSON(), _id: e.id, imageUrl: e.imageUrl })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/events/:id/approve
router.post('/events/:id/approve', superAdmin, async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        event.status = 'approved';
        await event.save();
        res.json({ message: 'Event approved' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/events/:id/reject
router.post('/events/:id/reject', superAdmin, async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        event.status = 'rejected';
        await event.save();
        res.json({ message: 'Event rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== USER MANAGEMENT (Super Admin) ====================

// @route   GET /api/admin/users
router.get('/users', superAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            where: { role: { [Op.in]: ['super_admin', 'admin'] } },
            attributes: ['id', 'name', 'email', 'role', 'balance']
        });
        res.json(users.map(u => ({ ...u.toJSON(), _id: u.id })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/users
router.post('/users', superAdmin, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const exists = await User.findOne({ where: { email } });
        if (exists) return res.status(400).json({ message: 'Email sudah terdaftar' });

        const user = await User.create({ name, email, password, role: 'admin' });
        res.status(201).json({ _id: user.id, name: user.name, email: user.email, role: user.role });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', superAdmin, async (req, res) => {
    try {
        if (parseInt(req.params.id) === req.user.id) {
            return res.status(400).json({ message: 'Cannot delete yourself' });
        }
        await User.destroy({ where: { id: req.params.id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SPONSORS (Super Admin) ====================

// @route   GET /api/admin/sponsors
router.get('/sponsors', superAdmin, async (req, res) => {
    try {
        const sponsors = await Sponsor.findAll({ order: [['order', 'ASC']] });
        res.json(sponsors.map(s => ({ ...s.toJSON(), _id: s.id, logoUrl: s.logoUrl })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/sponsors
router.post('/sponsors', superAdmin, uploadSponsor.single('logo'), async (req, res) => {
    try {
        const { name, category, order } = req.body;
        const sponsor = await Sponsor.create({
            name,
            category,
            order: order || 0,
            logo: req.file?.filename || null
        });
        res.status(201).json({ ...sponsor.toJSON(), _id: sponsor.id, logoUrl: sponsor.logoUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/sponsors/:id
router.delete('/sponsors/:id', superAdmin, async (req, res) => {
    try {
        await Sponsor.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Sponsor deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== PHOTOGRAPHERS (Super Admin) ====================

// @route   GET /api/admin/photographers
router.get('/photographers', superAdmin, async (req, res) => {
    try {
        const photographers = await Photographer.findAll({ order: [['order', 'ASC']] });
        res.json(photographers.map(p => ({
            ...p.toJSON(),
            _id: p.id,
            photoUrl: p.photoUrl,
            gradientFrom: p.gradient_from,
            gradientTo: p.gradient_to
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/photographers
router.post('/photographers', superAdmin, uploadPhotographer.single('photo'), async (req, res) => {
    try {
        const { name, team, category, gradientFrom, gradientTo, order } = req.body;
        const photographer = await Photographer.create({
            name,
            team,
            category,
            gradient_from: gradientFrom || '#667eea',
            gradient_to: gradientTo || '#764ba2',
            order: order || 0,
            photo: req.file?.filename || null
        });
        res.status(201).json({ ...photographer.toJSON(), _id: photographer.id, photoUrl: photographer.photoUrl });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/photographers/:id
router.delete('/photographers/:id', superAdmin, async (req, res) => {
    try {
        await Photographer.destroy({ where: { id: req.params.id } });
        res.json({ message: 'Photographer deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SPONSORS (Super Admin) ====================

// @route   GET /api/admin/sponsors
router.get('/sponsors', superAdmin, async (req, res) => {
    try {
        const sponsors = await Sponsor.findAll({
            order: [['order', 'ASC'], ['created_at', 'DESC']]
        });
        res.json(sponsors.map(s => ({
            ...s.toJSON(),
            _id: s.id,
            logoUrl: s.logoUrl
        })));
    } catch (error) {
        console.error('Sponsors error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/sponsors
router.post('/sponsors', superAdmin, uploadSponsor.single('logo'), async (req, res) => {
    try {
        const { name, category, order } = req.body;
        const sponsor = await Sponsor.create({
            name,
            category: category || null,
            logo: req.file?.filename || null,
            order: order || 0
        });
        res.status(201).json({ ...sponsor.toJSON(), _id: sponsor.id, logoUrl: sponsor.logoUrl });
    } catch (error) {
        console.error('Create sponsor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/sponsors/:id
router.put('/sponsors/:id', superAdmin, uploadSponsor.single('logo'), async (req, res) => {
    try {
        const sponsor = await Sponsor.findByPk(req.params.id);
        if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });

        const { name, category, order } = req.body;
        sponsor.name = name || sponsor.name;
        sponsor.category = category !== undefined ? category : sponsor.category;
        sponsor.order = order !== undefined ? order : sponsor.order;
        if (req.file) sponsor.logo = req.file.filename;

        await sponsor.save();
        res.json({ ...sponsor.toJSON(), _id: sponsor.id, logoUrl: sponsor.logoUrl });
    } catch (error) {
        console.error('Update sponsor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/sponsors/:id
router.delete('/sponsors/:id', superAdmin, async (req, res) => {
    try {
        const sponsor = await Sponsor.findByPk(req.params.id);
        if (!sponsor) return res.status(404).json({ message: 'Sponsor not found' });

        // Delete logo file if exists
        if (sponsor.logo) {
            const logoPath = path.join(__dirname, '../uploads/sponsors', sponsor.logo);
            if (fs.existsSync(logoPath)) fs.unlinkSync(logoPath);
        }

        await sponsor.destroy();
        res.json({ message: 'Sponsor deleted' });
    } catch (error) {
        console.error('Delete sponsor error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== ADMIN USERS (Super Admin) ====================

// @route   GET /api/admin/users
router.get('/users', superAdmin, async (req, res) => {
    try {
        const users = await User.findAll({
            where: { role: { [Op.in]: ['super_admin', 'admin'] } },
            attributes: ['id', 'name', 'email', 'role', 'balance', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        res.json(users.map(u => ({
            ...u.toJSON(),
            _id: u.id,
            createdAt: u.created_at
        })));
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/users
router.post('/users', superAdmin, async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if email exists
        const existing = await User.findOne({ where: { email } });
        if (existing) return res.status(400).json({ message: 'Email sudah terdaftar' });

        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'admin'
        });

        res.status(201).json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/admin/users/:id
router.put('/users/:id', superAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const { name, email, password, role } = req.body;

        // Check email uniqueness if changing
        if (email && email !== user.email) {
            const existing = await User.findOne({ where: { email } });
            if (existing) return res.status(400).json({ message: 'Email sudah terdaftar' });
            user.email = email;
        }

        if (name) user.name = name;
        if (role) user.role = role;

        if (password) {
            const bcrypt = require('bcryptjs');
            user.password = await bcrypt.hash(password, 10);
        }

        await user.save();

        res.json({
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            createdAt: user.created_at
        });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/users/:id
router.delete('/users/:id', superAdmin, async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Prevent deleting yourself
        if (user.id === req.user.id) {
            return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri' });
        }

        await user.destroy();
        res.json({ message: 'Admin deleted' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== SETTINGS (Super Admin) ====================

// @route   GET /api/admin/settings
router.get('/settings', superAdmin, async (req, res) => {
    try {
        const brand = await SiteSetting.getBrand();
        res.json(brand);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/settings
router.post('/settings', superAdmin, uploadSettings.single('logo'), async (req, res) => {
    try {
        const { site_name, tagline, contact_email, contact_phone } = req.body;

        if (site_name) await SiteSetting.setValue('site_name', site_name);
        if (tagline !== undefined) await SiteSetting.setValue('tagline', tagline);
        if (contact_email !== undefined) await SiteSetting.setValue('contact_email', contact_email);
        if (contact_phone !== undefined) await SiteSetting.setValue('contact_phone', contact_phone);
        if (req.file) await SiteSetting.setValue('site_logo', req.file.filename);

        const brand = await SiteSetting.getBrand();
        res.json(brand);
    } catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/admin/settings/logo
router.delete('/settings/logo', superAdmin, async (req, res) => {
    try {
        await SiteSetting.setValue('site_logo', null);
        res.json({ message: 'Logo removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== BALANCE & WITHDRAWALS ====================

// @route   GET /api/admin/balance
router.get('/balance', async (req, res) => {
    try {
        const withdrawals = await WithdrawalRequest.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        res.json({
            balance: parseFloat(req.user.balance),
            withdrawals: withdrawals.map(w => ({
                ...w.toJSON(),
                _id: w.id,
                amount: parseFloat(w.amount),
                bankName: w.bank_name,
                accountNumber: w.account_number,
                accountName: w.account_name
            }))
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/withdrawals
router.post('/withdrawals', async (req, res) => {
    try {
        const { amount, bankName, accountNumber, accountName } = req.body;
        const balance = parseFloat(req.user.balance);

        if (parseFloat(amount) > balance) {
            return res.status(400).json({ message: 'Saldo tidak mencukupi' });
        }
        if (parseFloat(amount) < 50000) {
            return res.status(400).json({ message: 'Minimal penarikan Rp 50.000' });
        }

        const withdrawal = await WithdrawalRequest.create({
            user_id: req.user.id,
            amount,
            bank_name: bankName,
            account_number: accountNumber,
            account_name: accountName,
            status: 'pending'
        });

        res.status(201).json({ ...withdrawal.toJSON(), _id: withdrawal.id });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/admin/withdrawals (Super Admin - all requests)
router.get('/withdrawals', superAdmin, async (req, res) => {
    try {
        const withdrawals = await WithdrawalRequest.findAll({
            include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
            order: [['created_at', 'DESC']]
        });
        res.json(withdrawals.map(w => ({
            ...w.toJSON(),
            _id: w.id,
            amount: parseFloat(w.amount),
            bankName: w.bank_name,
            accountNumber: w.account_number,
            accountName: w.account_name,
            userId: w.user
        })));
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/withdrawals/:id/approve
router.post('/withdrawals/:id/approve', superAdmin, async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const withdrawal = await WithdrawalRequest.findByPk(req.params.id, { transaction: t });
        if (!withdrawal) {
            await t.rollback();
            return res.status(404).json({ message: 'Request not found' });
        }
        if (!withdrawal.isPending()) {
            await t.rollback();
            return res.status(400).json({ message: 'Request already processed' });
        }

        // Deduct balance
        await User.decrement('balance', {
            by: parseFloat(withdrawal.amount),
            where: { id: withdrawal.user_id },
            transaction: t
        });

        // Update status
        withdrawal.status = 'approved';
        withdrawal.processed_by = req.user.id;
        withdrawal.processed_at = new Date();
        withdrawal.admin_notes = req.body.notes || null;
        await withdrawal.save({ transaction: t });

        await t.commit();
        res.json({ message: 'Withdrawal approved' });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/withdrawals/:id/reject
router.post('/withdrawals/:id/reject', superAdmin, async (req, res) => {
    try {
        const withdrawal = await WithdrawalRequest.findByPk(req.params.id);
        if (!withdrawal) return res.status(404).json({ message: 'Request not found' });
        if (!withdrawal.isPending()) return res.status(400).json({ message: 'Request already processed' });

        withdrawal.status = 'rejected';
        withdrawal.processed_by = req.user.id;
        withdrawal.processed_at = new Date();
        withdrawal.admin_notes = req.body.notes || null;
        await withdrawal.save();

        res.json({ message: 'Withdrawal rejected' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// ==================== UPCOMING EVENTS CALENDAR ====================

// Category labels
const CATEGORY_LABELS = {
    drag: 'Drag Race',
    drift: 'Drift',
    rally: 'Rally',
    touring: 'Touring',
    moto: 'Moto GP',
    road_race: 'Road Race'
};

// @route   GET /api/admin/upcoming-events
// @desc    Get all events for calendar management (including expired)
router.get('/upcoming-events', async (req, res) => {
    try {
        const now = new Date();
        const events = await Event.findAll({
            where: {
                start_time: { [Op.ne]: null }
            },
            order: [['start_time', 'DESC']],
            include: [{ model: User, as: 'creator', attributes: ['id', 'name'] }]
        });

        const eventsWithStatus = events.map(e => {
            const startTime = new Date(e.start_time);
            const isExpired = startTime <= now;

            return {
                id: e.id,
                title: e.name,
                name: e.name,
                category: e.category,
                categoryLabel: CATEGORY_LABELS[e.category] || e.category,
                location: e.location,
                start_time: e.start_time,
                startTime: e.start_time,
                external_link: e.external_link,
                is_published: e.is_published,
                isPublished: e.is_published,
                status: e.status,
                eventStatus: isExpired ? 'expired' : 'upcoming',
                isExpired,
                image: e.image,
                imageUrl: e.imageUrl || (e.image ? `/uploads/events/${e.image}` : null),
                creator: e.creator,
                createdAt: e.createdAt
            };
        });

        res.json(eventsWithStatus);
    } catch (error) {
        console.error('Get upcoming events error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   GET /api/admin/upcoming-events/:id
// @desc    Get single upcoming event
router.get('/upcoming-events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        res.json({
            id: event.id,
            title: event.name,
            name: event.name,
            category: event.category,
            location: event.location,
            date: event.date,
            start_time: event.start_time,
            external_link: event.external_link,
            is_published: event.is_published,
            status: event.status,
            image: event.image,
            imageUrl: event.imageUrl
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/admin/upcoming-events
// @desc    Create new upcoming event
router.post('/upcoming-events', uploadEvent.single('image'), async (req, res) => {
    try {
        const { title, category, location, start_time, external_link, is_published } = req.body;

        if (!title || !start_time) {
            return res.status(400).json({ message: 'Title and start time are required' });
        }

        const eventData = {
            name: title,
            category: category || 'road_race',
            location: location || '',
            date: new Date(start_time).toISOString().split('T')[0],
            start_time: new Date(start_time),
            external_link: external_link || null,
            is_published: is_published === 'true' || is_published === true,
            status: 'approved',
            created_by: req.user.id
        };

        if (req.file) {
            eventData.image = req.file.filename;
        }

        const event = await Event.create(eventData);

        res.status(201).json({
            message: 'Event created successfully',
            event: {
                ...event.toJSON(),
                imageUrl: event.imageUrl
            }
        });
    } catch (error) {
        console.error('Create upcoming event error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   PUT /api/admin/upcoming-events/:id
// @desc    Update upcoming event
router.put('/upcoming-events/:id', uploadEvent.single('image'), async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const { title, category, location, start_time, external_link, is_published } = req.body;

        if (title) event.name = title;
        if (category) event.category = category;
        if (location !== undefined) event.location = location;
        if (start_time) {
            event.start_time = new Date(start_time);
            event.date = new Date(start_time).toISOString().split('T')[0];
        }
        if (external_link !== undefined) event.external_link = external_link;
        if (is_published !== undefined) {
            event.is_published = is_published === 'true' || is_published === true;
        }

        if (req.file) {
            // Delete old image
            if (event.image) {
                const oldPath = path.join(__dirname, '../uploads/events', event.image);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
            event.image = req.file.filename;
        }

        await event.save();

        res.json({
            message: 'Event updated successfully',
            event: {
                ...event.toJSON(),
                imageUrl: event.imageUrl
            }
        });
    } catch (error) {
        console.error('Update upcoming event error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   DELETE /api/admin/upcoming-events/:id
// @desc    Delete upcoming event
router.delete('/upcoming-events/:id', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        // Delete image if exists
        if (event.image) {
            const imagePath = path.join(__dirname, '../uploads/events', event.image);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }

        await event.destroy();
        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Delete upcoming event error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// @route   PATCH /api/admin/upcoming-events/:id/toggle-publish
// @desc    Toggle event publish status
router.patch('/upcoming-events/:id/toggle-publish', async (req, res) => {
    try {
        const event = await Event.findByPk(req.params.id);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        event.is_published = !event.is_published;
        await event.save();

        res.json({
            message: event.is_published ? 'Event published' : 'Event unpublished',
            is_published: event.is_published
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;

