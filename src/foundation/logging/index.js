/**
 * Foundation Logging System Exports
 * 
 * Centralized exports for the structured logging system components.
 */

export { Logger } from './Logger.js';
export { LoggerFactory, defaultLoggerFactory, getLogger } from './LoggerFactory.js';
export { ConsoleTransport } from './transports/ConsoleTransport.js';
export { FileTransport } from './transports/FileTransport.js';
export { ActionLoggingMiddleware, createActionLoggingMiddleware } from './middleware/ActionLoggingMiddleware.js';

// Re-export convenience function for easy access
export { getLogger as createLogger } from './LoggerFactory.js';