const EventEmitter = require('events');

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 3;
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE) || 20;
const DOWNLOAD_TIMEOUT = parseInt(process.env.DOWNLOAD_TIMEOUT_MS) || 300000;
const ABANDON_TIMEOUT = 30000;

class DownloadQueue extends EventEmitter {
  constructor() {
    super();
    this.active = new Map();   // jobId -> { startedAt, timeout }
    this.waiting = [];         // [{ jobId, startFn, lastPoll }]
    this.completedDurations = []; // track last 20 download durations for ETA
  }

  get concurrent() { return this.active.size; }
  get queueLength() { return this.waiting.length; }

  /**
   * Enqueue a download. Returns { queued: bool, position: number|null }
   * startFn() is called when it's this job's turn — it should kick off the actual download
   * and return a promise or set job.done=true when finished.
   */
  enqueue(jobId, startFn) {
    if (this.active.size < MAX_CONCURRENT) {
      this._startJob(jobId, startFn);
      return { queued: false, position: null };
    }
    if (this.waiting.length >= MAX_QUEUE_SIZE) {
      return { queued: false, position: null, rejected: true };
    }
    const entry = { jobId, startFn, lastPoll: Date.now() };
    this.waiting.push(entry);
    return { queued: true, position: this.waiting.length };
  }

  _startJob(jobId, startFn) {
    const startedAt = Date.now();
    const timeout = setTimeout(() => {
      this._jobFinished(jobId, true);
    }, DOWNLOAD_TIMEOUT);
    this.active.set(jobId, { startedAt, timeout });
    startFn();
  }

  jobFinished(jobId) {
    this._jobFinished(jobId, false);
  }

  _jobFinished(jobId, timedOut) {
    const entry = this.active.get(jobId);
    if (entry) {
      clearTimeout(entry.timeout);
      const duration = Date.now() - entry.startedAt;
      if (!timedOut) {
        this.completedDurations.push(duration);
        if (this.completedDurations.length > 20) this.completedDurations.shift();
      }
      this.active.delete(jobId);
    }
    this._processNext();
  }

  _processNext() {
    while (this.active.size < MAX_CONCURRENT && this.waiting.length > 0) {
      const next = this.waiting.shift();
      this._startJob(next.jobId, next.startFn);
    }
  }

  /** Get position of a job in the waiting queue (1-based), or null if not queued */
  getPosition(jobId) {
    const idx = this.waiting.findIndex(e => e.jobId === jobId);
    return idx >= 0 ? idx + 1 : null;
  }

  isActive(jobId) {
    return this.active.has(jobId);
  }

  /** Record a poll for a queued job (keeps it alive) */
  recordPoll(jobId) {
    const entry = this.waiting.find(e => e.jobId === jobId);
    if (entry) entry.lastPoll = Date.now();
  }

  /** Average download duration in ms */
  get avgDuration() {
    if (this.completedDurations.length === 0) return 40000; // default 40s
    return this.completedDurations.reduce((a, b) => a + b, 0) / this.completedDurations.length;
  }

  /** Estimated wait in ms for a given position */
  estimateWait(position) {
    if (!position) return 0;
    // Each "slot" that frees up processes one from queue
    // Rough: position * avgDuration / MAX_CONCURRENT
    return Math.round(position * this.avgDuration / MAX_CONCURRENT);
  }

  status(jobId) {
    const pos = jobId ? this.getPosition(jobId) : undefined;
    return {
      concurrent: this.active.size,
      maxConcurrent: MAX_CONCURRENT,
      queueLength: this.waiting.length,
      ...(pos != null && { position: pos, estimatedWaitMs: this.estimateWait(pos) }),
    };
  }

  /** Remove abandoned jobs (no poll in 30s) */
  cleanup() {
    const now = Date.now();
    this.waiting = this.waiting.filter(e => (now - e.lastPoll) < ABANDON_TIMEOUT);
  }
}

const queue = new DownloadQueue();

// Periodic cleanup of abandoned queue entries
setInterval(() => queue.cleanup(), 10000);

module.exports = queue;
