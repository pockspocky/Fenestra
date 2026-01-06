/**
 * Transport Factory
 * 
 * Creates transport instances from configuration objects
 */

import { ConsoleTransport } from './transports/ConsoleTransport.js';
import { FileTransport } from './transports/FileTransport.js';

export class TransportFactory {
  /**
   * Create transport instances from configuration
   * @param {Array} transportConfigs - Array of transport configuration objects
   * @returns {Array} Array of transport instances
   */
  static createTransports(transportConfigs) {
    if (!Array.isArray(transportConfigs)) {
      return [];
    }
    
    return transportConfigs.map(config => {
      return TransportFactory.createTransport(config);
    }).filter(transport => transport !== null);
  }
  
  /**
   * Create a single transport instance from configuration
   * @param {Object} config - Transport configuration object
   * @returns {Transport|null} Transport instance or null if invalid
   */
  static createTransport(config) {
    if (!config || !config.type) {
      return null;
    }
    
    try {
      switch (config.type) {
        case 'console':
          return new ConsoleTransport({
            level: config.level,
            format: config.format,
            ...config.options
          });
          
        case 'file':
          return new FileTransport({
            level: config.level,
            format: config.format,
            filename: config.options?.filename || 'app.log',
            ...config.options
          });
          
        default:
          console.warn(`[TransportFactory] Unknown transport type: ${config.type}`);
          return null;
      }
    } catch (error) {
      console.error(`[TransportFactory] Failed to create transport:`, error);
      return null;
    }
  }
}