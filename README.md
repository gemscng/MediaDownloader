# MediaDownloader

Free video downloader supporting YouTube, Facebook, Instagram, TikTok, Threads, Twitter/X and 1000+ sites.

## Setup

```bash
npm install
cp .env.example .env  # optional, defaults work fine
npm start
```

Server runs on http://localhost:3003

## Features

- Multi-platform video download (YouTube, FB, IG, TikTok, Threads, Twitter/X)
- Quality selection (480p, 720p, 1080p, Best)
- Audio extraction (MP3, M4A)
- MP3 trimming & ringtone maker
- Video upload tools (extract audio, remove audio)
- Direct download mode (no server storage)
- Admin panel with cookie management (`/admin`)
- Auto-cleanup of temp files (1 hour)
- SEO optimized with structured data

## Project Structure

```
server.js              # Entry point
src/
  config.js            # Environment configuration
  logger.js            # Timestamped logging
  middleware/
    cors.js            # CORS headers
    errorHandler.js    # Global error handler
  routes/
    admin.js           # Admin panel & health check
    download.js        # Download & video info endpoints
    files.js           # File listing, serving, deletion
    upload.js          # Video upload & processing
  services/
    cleanupService.js  # Auto-cleanup temp files
    downloadService.js # yt-dlp wrapper
    ffmpegService.js   # FFmpeg audio/video processing
    fileService.js     # File management
    jobManager.js      # Download job tracking
public/
  index.html           # Main frontend
  admin.html           # Admin panel
  css/style.css        # Styles
  js/app.js            # Frontend JavaScript
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3003 | Server port |
| DOWNLOAD_DIR | ./downloads | Download directory |
| COOKIE_PATH | ./cookies.txt | yt-dlp cookies file |
| MAX_FILE_SIZE | 500 | Max upload size (MB) |
| TEMP_MAX_AGE_MS | 3600000 | File cleanup age (ms) |
| CLEANUP_INTERVAL_MS | 600000 | Cleanup check interval (ms) |

## Requirements

- Node.js 18+
- yt-dlp
- ffmpeg
