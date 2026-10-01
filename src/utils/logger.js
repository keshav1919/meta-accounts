/**
 * Production Logger with credential redaction
 */

const sanitizeLogMessage = (msg) => {
  if (typeof msg !== 'string') return msg;
  return msg
    .replace(/(password\s*[:=-]\s*)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(token\s*[:=-]\s*)[^\s]+/gi, '$1[REDACTED]')
    .replace(/(postgres:\/\/[^:]+:)[^@]+(@)/gi, '$1[REDACTED]$2');
};

const formatOutput = (level, ...args) => {
  const timestamp = new Date().toISOString();
  const cleaned = args.map((arg) => {
    if (typeof arg === 'string') return sanitizeLogMessage(arg);
    if (arg instanceof Error) return arg.stack || arg.message;
    if (typeof arg === 'object' && arg !== null) {
      try {
        const copy = JSON.parse(JSON.stringify(arg));
        if (copy.password) copy.password = '[REDACTED]';
        return JSON.stringify(copy);
      } catch {
        return String(arg);
      }
    }
    return arg;
  });
  return `[${timestamp}] [${level}] ${cleaned.join(' ')}`;
};

const logger = {
  info: (...args) => console.log(formatOutput('INFO', ...args)),
  warn: (...args) => console.warn(formatOutput('WARN', ...args)),
  error: (...args) => console.error(formatOutput('ERROR', ...args)),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(formatOutput('DEBUG', ...args));
    }
  },
};

module.exports = logger;
