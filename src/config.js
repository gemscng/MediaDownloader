const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

module.exports = {
  PORT: parseInt(process.env.PORT) || 3003,
  DOWNLOAD_DIR: path.resolve(__dirname, '..', process.env.DOWNLOAD_DIR || './downloads'),
  COOKIE_FILE: path.resolve(__dirname, '..', process.env.COOKIE_PATH || './cookies.txt'),
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 500, // MB
  TEMP_MAX_AGE_MS: parseInt(process.env.TEMP_MAX_AGE_MS) || 60 * 60 * 1000,
  CLEANUP_INTERVAL_MS: parseInt(process.env.CLEANUP_INTERVAL_MS) || 10 * 60 * 1000,
};
