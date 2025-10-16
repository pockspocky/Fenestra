/**
 * 日志配置管理器
 * 统一管理所有模块的日志级别
 */

// 设置日志级别
global.logLevel = "debug"; // 可以改为 "debug", "log", "warn", "error", "none"

/**
 * 设置日志级别
 * @param {string} level - 日志级别
 */
export function setLogLevel(level) {
  const validLevels = ["debug", "log", "warn", "error", "none"];
  if (validLevels.includes(level)) {
    global.logLevel = level;
    console.log(`[LOGGER] 日志级别已设置为: ${level}`);
  } else {
    console.warn(`[LOGGER] 无效的日志级别: ${level}，有效级别: ${validLevels.join(', ')}`);
  }
}

/**
 * 获取当前日志级别
 * @returns {string} 当前日志级别
 */
export function getLogLevel() {
  return global.logLevel;
}

/**
 * 获取所有可用的日志级别
 * @returns {Array} 日志级别数组
 */
export function getAvailableLogLevels() {
  return ["debug", "log", "warn", "error", "none"];
}

/**
 * 设置开发环境日志级别
 */
export function setDevelopmentLogLevel() {
  setLogLevel("debug");
  console.debug("[LOGGER] 已设置为开发环境日志级别");
}

/**
 * 设置生产环境日志级别
 */
export function setProductionLogLevel() {
  setLogLevel("warn");
  console.warn("[LOGGER] 已设置为生产环境日志级别");
}

/**
 * 设置测试环境日志级别
 */
export function setTestLogLevel() {
  setLogLevel("error");
  console.error("[LOGGER] 已设置为测试环境日志级别");
}

/**
 * 根据环境变量设置日志级别
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

// 根据环境自动设置日志级别
setLogLevelFromEnv();
