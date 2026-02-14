/**
 * Logger Configuration Manager
 * Centrally manages log levels for all modules
 */

// Set log level
global.logLevel = "debug"; // Can be changed to "debug", "log", "warn", "error", "none"

/**
 * Set log level
 * @param {string} level - Log level
 */
export function setLogLevel(level) {
  const validLevels = ["debug", "log", "warn", "error", "none"];
  if (validLevels.includes(level)) {
    global.logLevel = level;
    console.log(`[LOGGER] Log level set to: ${level}`);
  } else {
    console.warn(`[LOGGER] Invalid log level: ${level}, valid levels: ${validLevels.join(', ')}`);
  }
}

/**
 * Get current log level
 * @returns {string} Current log level
 */
export function getLogLevel() {
  return global.logLevel;
}

/**
 * Get all available log levels
 * @returns {Array} Log level array
 */
export function getAvailableLogLevels() {
  return ["debug", "log", "warn", "error", "none"];
}

/**
 * Set development environment log level
 */
export function setDevelopmentLogLevel() {
  setLogLevel("debug");
  console.debug("[LOGGER] Set to development environment log level");
}

/**
 * Set production environment log level
 */
export function setProductionLogLevel() {
  setLogLevel("warn");
  console.warn("[LOGGER] Set to production environment log level");
}

/**
 * Set test environment log level
 */
export function setTestLogLevel() {
  setLogLevel("error");
  console.error("[LOGGER] Set to test environment log level");
}

/**
 * Set log level from environment variable
 */
export function setLogLevelFromEnv() {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      setProductionLogLevel();
      break;
    case 'test':
      setTestLogLevel();
      break;
    case 'development':
    default:
      setDevelopmentLogLevel();
      break;
  }
}

// Automatically set log level based on environment
setLogLevelFromEnv();
