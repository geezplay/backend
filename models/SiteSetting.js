const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SiteSetting = sequelize.define('SiteSetting', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'site_settings'
});

// Static methods
SiteSetting.getValue = async function (key, defaultValue = null) {
    const setting = await this.findOne({ where: { key } });
    return setting ? setting.value : defaultValue;
};

SiteSetting.setValue = async function (key, value) {
    const [setting] = await this.upsert({ key, value });
    return setting;
};

SiteSetting.getBrand = async function () {
    const siteName = await this.getValue('site_name', 'RacePhoto');
    const siteLogo = await this.getValue('site_logo', null);
    const tagline = await this.getValue('tagline', '');
    const contactEmail = await this.getValue('contact_email', '');
    const contactPhone = await this.getValue('contact_phone', '');

    return {
        site_name: siteName,
        tagline: tagline,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        logo_url: siteLogo ? `/uploads/settings/${siteLogo}` : null,
        // Legacy aliases
        siteName,
        siteLogo: siteLogo ? `/uploads/settings/${siteLogo}` : null
    };
};

module.exports = SiteSetting;
