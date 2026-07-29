const express = require('express');
const { executeCode, SUPPORTED_LANGUAGES } = require('../services/codeExecutor');
const { protect } = require('../middleware/auth');
const executeRateLimiter = require('../middleware/executeRateLimiter');

const router = express.Router();
router.use(protect);
router.use(executeRateLimiter);

// @route   POST /api/execute
// @desc    Run submitted code in a timeout-boxed process and return the output.
//          See services/codeExecutor.js and the README for the security model.
router.post('/', async (req, res) => {
  try {
    const { language, code, stdin } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ message: 'No code provided' });
    }
    if (code.length > 20000) {
      return res.status(400).json({ message: 'Code exceeds the 20,000 character limit' });
    }
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        message: `Unsupported language. Supported languages: ${SUPPORTED_LANGUAGES.join(', ')}`,
      });
    }

    const result = await executeCode({ language, code, stdin });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Execution failed', error: err.message });
  }
});

module.exports = router;
