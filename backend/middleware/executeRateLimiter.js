// A minimal per-user rate limiter for the code execution endpoint. Running
// code is far more expensive than a normal CRUD request, so this deserves
// its own stricter limit rather than relying on any general API rate limit.
const MAX_RUNS_PER_WINDOW = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

const userRunLog = new Map(); // userId -> array of timestamps

function executeRateLimiter(req, res, next) {
  const userId = req.user._id.toString();
  const now = Date.now();

  const timestamps = (userRunLog.get(userId) || []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_RUNS_PER_WINDOW) {
    return res.status(429).json({
      message: `Rate limit exceeded: max ${MAX_RUNS_PER_WINDOW} code runs per minute. Please wait a moment.`,
    });
  }

  timestamps.push(now);
  userRunLog.set(userId, timestamps);
  next();
}

module.exports = executeRateLimiter;
