/**
 * Scoped logging utility for debugging and production
 */

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === 'true';

/**
 * Debug logger with scope prefixing
 */
export function debug(scope: string, ...args: any[]): void {
  if (DEBUG_ENABLED) {
    console.log(`[${scope}]`, ...args);
  }
}

/**
 * Warning logger (always enabled)
 */
export function warn(scope: string, ...args: any[]): void {
  console.warn(`[${scope}]`, ...args);
}

/**
 * Error logger (always enabled)
 */
export function error(scope: string, ...args: any[]): void {
  console.error(`[${scope}]`, ...args);
}

/**
 * Info logger (always enabled in development)
 */
export function info(scope: string, ...args: any[]): void {
  if (process.env.NODE_ENV === 'development' || DEBUG_ENABLED) {
    console.info(`[${scope}]`, ...args);
  }
}


