require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { PORT, DOWNLOAD_DIR } = require('./src/config');
const log = require('./src/logger');
const cors = require('./src/middleware/cors');
const errorHandler = require('./src/middleware/errorHandler');
const cleanupService = require('./src/services/cleanupService');

// Ensure download dir exists
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const app = express();

// Middleware
app.use(cors);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use(require('./src/routes/download'));
app.use(require('./src/routes/files'));
app.use(require('./src/routes/upload'));
app.use(require('./src/routes/admin'));

// Error handler
app.use(errorHandler);

// Start cleanup service
cleanupService.start();

// Global error handlers
process.on('uncaughtException', (err) => log.error('Uncaught:', err.message));
process.on('unhandledRejection', (err) => log.error('Unhandled:', err));

app.listen(PORT, () => log.info(`Video Downloader running at http://0.0.0.0:${PORT}`));
