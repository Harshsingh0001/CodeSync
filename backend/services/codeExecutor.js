const { spawn } = require('child_process');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Execution limits - deliberately conservative for a personal/free-tier server.
const TIMEOUT_MS = 5000; // kill the process if it runs longer than this
const MAX_OUTPUT_BYTES = 50 * 1000; // truncate stdout/stderr past ~50KB

// Maps a language name to how its file should run.
// `file` is the filename the source gets written to inside the temp dir.
const RUNNERS = {
  javascript: {
    file: 'main.js',
    command: (filePath) => ({ cmd: 'node', args: [filePath] }),
  },
  python: {
    file: 'main.py',
    command: (filePath) => ({ cmd: 'python3', args: [filePath] }),
  },
};

const SUPPORTED_LANGUAGES = Object.keys(RUNNERS);

/**
 * Executes user-submitted code in an isolated temp directory with a hard
 * timeout and output size cap. This is a timeout-boxed child process, NOT a
 * full container sandbox - see README for the honest security tradeoffs.
 */
async function executeCode({ language, code, stdin = '' }) {
  const runner = RUNNERS[language];
  if (!runner) {
    return {
      stdout: '',
      stderr: `Unsupported language: "${language}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
      exitCode: null,
      timedOut: false,
    };
  }

  // Each run gets its own throwaway directory so concurrent executions
  // never collide and so we can wipe everything in one step afterward.
  const runId = crypto.randomBytes(8).toString('hex');
  const workDir = path.join(os.tmpdir(), `codesync-${runId}`);
  await fs.mkdir(workDir, { recursive: true });
  const filePath = path.join(workDir, runner.file);

  try {
    await fs.writeFile(filePath, code, 'utf8');
    const { cmd, args } = runner.command(filePath);
    return await runProcess(cmd, args, stdin, workDir);
  } finally {
    // Always clean up, even if execution failed or timed out.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runProcess(cmd, args, stdin, cwd) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      cwd,
      timeout: TIMEOUT_MS, // Node kills the process automatically past this
      // No network/filesystem sandboxing beyond the OS user's own permissions -
      // this relies on the host process running as a low-privilege user.
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const truncate = (buf, current) => {
      if (current.length >= MAX_OUTPUT_BYTES) return current;
      return current + buf.toString();
    };

    child.stdout.on('data', (data) => {
      stdout = truncate(data, stdout);
    });
    child.stderr.on('data', (data) => {
      stderr = truncate(data, stderr);
    });

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on('error', (err) => {
      resolve({ stdout, stderr: `Execution error: ${err.message}`, exitCode: null, timedOut: false });
    });

    child.on('close', (exitCode, signal) => {
      if (signal === 'SIGTERM') timedOut = true;
      resolve({
        stdout: stdout.length >= MAX_OUTPUT_BYTES ? stdout + '\n...[output truncated]' : stdout,
        stderr,
        exitCode,
        timedOut,
      });
    });
  });
}

module.exports = { executeCode, SUPPORTED_LANGUAGES };
