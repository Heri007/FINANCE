// config/logger.js
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Ensure logs directory exists to avoid transport errors
const logDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
} catch (e) {
  // If directory creation fails, at least continue with console transport
  console.error('Could not create logs directory:', e.message);
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
