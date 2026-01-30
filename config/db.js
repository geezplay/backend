// Database connection config
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'racephoto',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Connected');

    // Sync models (create tables if not exist)
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synced');
  } catch (error) {
    console.error('MySQL connection error:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
