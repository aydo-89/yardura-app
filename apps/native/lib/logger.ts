/**
 * Production-safe logger that only outputs in development mode.
 * This prevents debug logs from appearing in production builds
 * and helps with App Store compliance.
 */

type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug';

function createLogger(level: LogLevel) {
  return (tag: string, ...args: unknown[]) => {
    if (__DEV__) {
      console[level](`[${tag}]`, ...args);
    }
    // In production, logs are silently ignored.
    // If crash reporting is needed, integrate Sentry here:
    // if (level === 'error') {
    //   Sentry.captureMessage(`[${tag}] ${args.join(' ')}`);
    // }
  };
}

export const logger = {
  log: createLogger('log'),
  info: createLogger('info'),
  warn: createLogger('warn'),
  error: createLogger('error'),
  debug: createLogger('debug'),
};

/**
 * Shorthand for common warning pattern in catch blocks.
 * Usage: logWarn('component.action.failed', error)
 */
export function logWarn(tag: string, error?: unknown) {
  if (__DEV__) {
    console.warn(tag, error);
  }
}

/**
 * Shorthand for common error pattern in catch blocks.
 * Usage: logError('component.action.failed', error)
 */
export function logError(tag: string, error?: unknown) {
  if (__DEV__) {
    console.error(tag, error);
  }
}
