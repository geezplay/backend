// Database connection config
// Load dotenv at the very beginning
require('dotenv').config();

const { Sequelize } = require('sequelize');

// Log environment for debugging (only in development or if DB connection fails)
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'racephoto',
  user: process.env.DB_USER || 'root',
  hasPassword: !!process.env.DB_PASSWORD
};

console.log('Database Config:', dbConfig);

const sequelize = new Sequelize(
  process.env.DB_NAME || 'u194239260_gp_app',
  process.env.DB_USER || 'u194239260_gp_adm',
  process.env.DB_PASSWORD || 'Akudika133@',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 60000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true
    },
    dialectOptions: {
      connectTimeout: 60000,
      // For Hostinger MySQL compatibility
      charset: 'utf8mb4',
      // Force IPv4 to avoid ::1 (IPv6) connection issues
      socketPath: null,
      flags: '-FOUND_ROWS',
      // Explicitly use IPv4
      family: 4
    },
    retry: {
      max: 3
    }
  }
);

let dbConnected = false;

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL Connected Successfully');
    dbConnected = true;

    // Only sync in development, not in production
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('Database synced (development mode)');
    } else {
      // In production, just verify connection
      console.log('Database ready (production mode - no sync)');
    }
  } catch (error) {
    console.error('=== MySQL Connection Error ===');
    console.error('Error Code:', error.original?.code || error.code);
    console.error('Error Message:', error.message);
    console.error('Config used:', dbConfig);

    // Don't exit in production, let the app run
    if (process.env.NODE_ENV !== 'production') {
      console.error('Exiting due to database error (development mode)');
      process.exit(1);
    } else {
      console.error('Continuing without database (production mode)');
    }
  }
};

// Export dbConnected status for health checks
const isDBConnected = () => dbConnected;

module.exports = { sequelize, connectDB, isDBConnected };
