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
const compression = require('compression');

const SITE_URL = process.env.SITE_URL || 'https://dl.dood.gay';
const SUPPORTED_LANGS = ['en','zh','zh-TW','ja','ko','es','fr','de','pt','ru','ar','hi','th','vi','id','ms','tr','it','nl','pl','sv','da','fi','no'];

// Middleware
app.use(compression());
app.use(cors);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    }
  }
}));

// robots.txt
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
});

// sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  const urls = [
    { loc: SITE_URL + '/', priority: '1.0', changefreq: 'weekly' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.type('application/xml').send(xml);
});

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
