const User = require('./User');
const Event = require('./Event');
const EventClass = require('./EventClass');
const Photo = require('./Photo');
const RecapPhoto = require('./RecapPhoto');
const Order = require('./Order');
const OrderItem = require('./OrderItem');
const Sponsor = require('./Sponsor');
const Photographer = require('./Photographer');
const WithdrawalRequest = require('./WithdrawalRequest');
const SiteSetting = require('./SiteSetting');

// Define associations

// User -> Event (creator)
User.hasMany(Event, { foreignKey: 'created_by', as: 'events' });
Event.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Event -> EventClass
Event.hasMany(EventClass, { foreignKey: 'event_id', as: 'classes' });
EventClass.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// Event -> Photo
Event.hasMany(Photo, { foreignKey: 'event_id', as: 'photos' });
Photo.belongsTo(Event, { foreignKey: 'event_id', as: 'event' });

// User -> Photo (creator)
User.hasMany(Photo, { foreignKey: 'created_by', as: 'photos' });
Photo.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// Photo -> RecapPhoto
Photo.hasMany(RecapPhoto, { foreignKey: 'photo_id', as: 'recaps' });
RecapPhoto.belongsTo(Photo, { foreignKey: 'photo_id', as: 'photo' });

// Order -> OrderItem
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// Photo -> OrderItem
Photo.hasMany(OrderItem, { foreignKey: 'photo_id', as: 'orderItems' });
OrderItem.belongsTo(Photo, { foreignKey: 'photo_id', as: 'photo' });

// User -> WithdrawalRequest
User.hasMany(WithdrawalRequest, { foreignKey: 'user_id', as: 'withdrawals' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Processed by relation
User.hasMany(WithdrawalRequest, { foreignKey: 'processed_by', as: 'processedWithdrawals' });
WithdrawalRequest.belongsTo(User, { foreignKey: 'processed_by', as: 'processor' });

module.exports = {
    User,
    Event,
    EventClass,
    Photo,
    RecapPhoto,
    Order,
    OrderItem,
    Sponsor,
    Photographer,
    WithdrawalRequest,
    SiteSetting
};
