import path from 'node:path';
import fs from 'node:fs';
import '../../logger.js'; // Import logging system

/**
 * Configuration System for Fenestra
 * 
 * This module manages application configuration, particularly the game data directory
 * location and other system settings. It provides secure configuration management
 * with validation to prevent configuration outside project scope.
 */

// Default configuration values
const DEFAULT_CONFIG = {
  gameDataDirectory: './game-data',
  allowedFileExtensions: ['.fenestra', '.txt', '.md', '.json'],
  maxDirectoryDepth: 10,
  enableDirectoryLocking: true
};

// Configuration file path (relative to project root)
const CONFIG_FILE_PATH = '.fenestra-config.json';

// Cached configuration
let cachedConfig = null;

/**
 * Gets the current configuration, loading from file if necessary
 * @returns {Object} Current configuration object
 */
export function getConfig() {
  if (cachedConfig === null) {
    cachedConfig = loadConfig();
  }
  return { ...cachedConfig }; // Return a copy to prevent external modification
}

/**
 * Gets the game data directory path from configuration
 * @returns {string} Absolute path to the game data directory
 */
export function getGameDataDirectory() {
  const config = getConfig();
  const projectRoot = process.cwd();
  
  // Resolve the game data directory path relative to project root
  const gameDataPath = path.resolve(projectRoot, config.gameDataDirectory);
  
  console.debug(`[CONFIG] Game data directory: "${gameDataPath}"`);
  return gameDataPath;
}

/**
 * Sets the game data directory path with validation
 * @param {string} newPath - New path for the game data directory
 * @returns {Object} Result object with success status and any error message
 */
export function setGameDataDirectory(newPath) {
  console.debug(`[CONFIG] Setting game data directory to: "${newPath}"`);
  
  try {
    // Validate the new path
    const validation = validateGameDataDirectoryPath(newPath);
    
    if (!validation.isValid) {
      console.error(`[CONFIG] Invalid game data directory path: ${validation.error}`);
      return {
        success: false,
        error: validation.error
      };
    }
    
    // Update configuration
    const config = getConfig();
    config.gameDataDirectory = validation.relativePath;
    
    // Save configuration
    const saveResult = saveConfig(config);
    
    if (saveResult.success) {
      // Update cached configuration
      cachedConfig = config;
      console.log(`[CONFIG] Game data directory updated to: "${validation.absolutePath}"`);
      
      // Ensure the directory exists
      ensureGameDataDirectoryExists(validation.absolutePath);
      
      return {
        success: true,
        path: validation.absolutePath
      };
    } else {
      return saveResult;
    }
    
  } catch (error) {
    console.error(`[CONFIG] Failed to set game data directory:`, error);
    return {
      success: false,
      error: `Configuration update failed: ${error.message}`
    };
  }
}

/**
 * Validates a game data directory path
 * @param {string} inputPath - Path to validate
 * @returns {Object} Validation result with path information
 */
function validateGameDataDirectoryPath(inputPath) {
  try {
    if (!inputPath || typeof inputPath !== 'string') {
      return {
        isValid: false,
        error: 'Path is required and must be a string'
      };
    }
    
    const projectRoot = process.cwd();
    const normalizedProjectRoot = path.resolve(projectRoot);
    
    // Resolve the input path
    let absolutePath;
    if (path.isAbsolute(inputPath)) {
      absolutePath = path.resolve(inputPath);
    } else {
      absolutePath = path.resolve(projectRoot, inputPath);
    }
    
    // Check if the path is within project scope
    const relativePath = path.relative(normalizedProjectRoot, absolutePath);
    
    // Path is outside project scope if relative path starts with '..' or is absolute
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return {
        isValid: false,
        error: 'Game data directory must be within project scope'
      };
    }
    
    // Convert back to relative path for storage
    const relativeForStorage = './' + relativePath.replace(/\\/g, '/');
    
    console.debug(`[CONFIG] Path validation successful - Absolute: "${absolutePath}", Relative: "${relativeForStorage}"`);
    
    return {
      isValid: true,
      absolutePath,
      relativePath: relativeForStorage
    };
    
  } catch (error) {
    console.error(`[CONFIG] Path validation failed:`, error);
    return {
      isValid: false,
      error: `Path validation failed: ${error.message}`
    };
  }
}

/**
 * Loads configuration from file or returns default configuration
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const projectRoot = process.cwd();
  const configFilePath = path.join(projectRoot, CONFIG_FILE_PATH);
  
  try {
    if (fs.existsSync(configFilePath)) {
      console.debug(`[CONFIG] Loading configuration from: "${configFilePath}"`);
      
      const configData = fs.readFileSync(configFilePath, 'utf8');
      const parsedConfig = JSON.parse(configData);
      
      // Merge with defaults to ensure all required properties exist
      const config = { ...DEFAULT_CONFIG, ...parsedConfig };
      
      // Validate the loaded configuration
      const validation = validateConfiguration(config);
      
      if (validation.isValid) {
        console.log(`[CONFIG] Configuration loaded successfully`);
        return config;
      } else {
        console.warn(`[CONFIG] Invalid configuration file, using defaults: ${validation.error}`);
        return { ...DEFAULT_CONFIG };
      }
      
    } else {
      console.debug(`[CONFIG] No configuration file found, using defaults`);
      return { ...DEFAULT_CONFIG };
    }
    
  } catch (error) {
    console.error(`[CONFIG] Failed to load configuration:`, error);
    console.warn(`[CONFIG] Using default configuration`);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Saves configuration to file
 * @param {Object} config - Configuration object to save
 * @returns {Object} Result object with success status
 */
function saveConfig(config) {
  const projectRoot = process.cwd();
  const configFilePath = path.join(projectRoot, CONFIG_FILE_PATH);
  
  try {
    // Validate configuration before saving
    const validation = validateConfiguration(config);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: `Invalid configuration: ${validation.error}`
      };
    }
    
    // Save configuration to file
    const configData = JSON.stringify(config, null, 2);
    fs.writeFileSync(configFilePath, configData, 'utf8');
    
    console.log(`[CONFIG] Configuration saved to: "${configFilePath}"`);
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error(`[CONFIG] Failed to save configuration:`, error);
    return {
      success: false,
      error: `Failed to save configuration: ${error.message}`
    };
  }
}

/**
 * Validates a configuration object
 * @param {Object} config - Configuration object to validate
 * @returns {Object} Validation result
 */
function validateConfiguration(config) {
  try {
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        error: 'Configuration must be an object'
      };
    }
    
    // Validate game data directory
    if (config.gameDataDirectory) {
      const pathValidation = validateGameDataDirectoryPath(config.gameDataDirectory);
      if (!pathValidation.isValid) {
        return {
          isValid: false,
          error: `Invalid gameDataDirectory: ${pathValidation.error}`
        };
      }
    }
    
    // Validate other configuration properties
    if (config.allowedFileExtensions && !Array.isArray(config.allowedFileExtensions)) {
      return {
        isValid: false,
        error: 'allowedFileExtensions must be an array'
      };
    }
    
    if (config.maxDirectoryDepth && (typeof config.maxDirectoryDepth !== 'number' || config.maxDirectoryDepth < 1)) {
      return {
        isValid: false,
        error: 'maxDirectoryDepth must be a positive number'
      };
    }
    
    if (config.enableDirectoryLocking && typeof config.enableDirectoryLocking !== 'boolean') {
      return {
        isValid: false,
        error: 'enableDirectoryLocking must be a boolean'
      };
    }
    
    return {
      isValid: true
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: `Configuration validation failed: ${error.message}`
    };
  }
}

/**
 * Ensures the game data directory exists, creating it if necessary
 * @param {string} gameDataPath - Absolute path to the game data directory
 * @returns {Object} Result object with success status
 */
function ensureGameDataDirectoryExists(gameDataPath) {
  try {
    if (!fs.existsSync(gameDataPath)) {
      console.debug(`[CONFIG] Creating game data directory: "${gameDataPath}"`);
      fs.mkdirSync(gameDataPath, { recursive: true });
      console.log(`[CONFIG] Game data directory created: "${gameDataPath}"`);
    } else {
      console.debug(`[CONFIG] Game data directory already exists: "${gameDataPath}"`);
    }
    
    return {
      success: true
    };
    
  } catch (error) {
    console.error(`[CONFIG] Failed to create game data directory:`, error);
    return {
      success: false,
      error: `Failed to create directory: ${error.message}`
    };
  }
}

/**
 * Resets configuration to defaults
 * @returns {Object} Result object with success status
 */
export function resetConfigToDefaults() {
  console.debug(`[CONFIG] Resetting configuration to defaults`);
  
  try {
    const defaultConfig = { ...DEFAULT_CONFIG };
    const saveResult = saveConfig(defaultConfig);
    
    if (saveResult.success) {
      cachedConfig = defaultConfig;
      console.log(`[CONFIG] Configuration reset to defaults`);
      
      // Ensure default game data directory exists
      const gameDataPath = getGameDataDirectory();
      ensureGameDataDirectoryExists(gameDataPath);
      
      return {
        success: true
      };
    } else {
      return saveResult;
    }
    
  } catch (error) {
    console.error(`[CONFIG] Failed to reset configuration:`, error);
    return {
      success: false,
      error: `Failed to reset configuration: ${error.message}`
    };
  }
}

/**
 * Gets a specific configuration value
 * @param {string} key - Configuration key to retrieve
 * @param {*} defaultValue - Default value if key doesn't exist
 * @returns {*} Configuration value
 */
export function getConfigValue(key, defaultValue = null) {
  const config = getConfig();
  return config.hasOwnProperty(key) ? config[key] : defaultValue;
}

/**
 * Sets a specific configuration value
 * @param {string} key - Configuration key to set
 * @param {*} value - Value to set
 * @returns {Object} Result object with success status
 */
export function setConfigValue(key, value) {
  console.debug(`[CONFIG] Setting configuration value: ${key} = ${JSON.stringify(value)}`);
  
  try {
    const config = getConfig();
    config[key] = value;
    
    // Validate the updated configuration
    const validation = validateConfiguration(config);
    
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.error
      };
    }
    
    // Save the updated configuration
    const saveResult = saveConfig(config);
    
    if (saveResult.success) {
      cachedConfig = config;
      console.log(`[CONFIG] Configuration value updated: ${key}`);
      
      return {
        success: true
      };
    } else {
      return saveResult;
    }
    
  } catch (error) {
    console.error(`[CONFIG] Failed to set configuration value:`, error);
    return {
      success: false,
      error: `Failed to set configuration value: ${error.message}`
    };
  }
}

// Initialize configuration on module load
console.debug(`[CONFIG] Initializing configuration system`);
const initialConfig = getConfig();
const gameDataPath = getGameDataDirectory();
ensureGameDataDirectoryExists(gameDataPath);
console.log(`[CONFIG] Configuration system initialized - Game data directory: "${gameDataPath}"`);