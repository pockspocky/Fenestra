import path from 'node:path';
import fs from 'node:fs';
import '../../logger.js'; // Import logging system
import { 
  toForwardSlashes, 
  hasWindowsDriveLetter, 
  isUNCPath,
  resolvePath,
  toRelativePath
} from '../utils/pathUtils.js';

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
 * Handles Windows paths with drive letters, UNC paths, and ensures cross-platform compatibility
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
    const normalizedProjectRoot = resolvePath(projectRoot);
    
    // Validate Windows-specific path formats
    if (hasWindowsDriveLetter(inputPath)) {
      console.debug(`[CONFIG] Detected Windows path with drive letter: "${inputPath}"`);
      
      // Validate drive letter format (must be A-Z followed by colon)
      const driveMatch = inputPath.match(/^([a-zA-Z]):/);
      if (!driveMatch) {
        return {
          isValid: false,
          error: 'Invalid Windows drive letter format'
        };
      }
      
      // Check if the drive letter is valid (A-Z)
      const driveLetter = driveMatch[1].toUpperCase();
      if (driveLetter < 'A' || driveLetter > 'Z') {
        return {
          isValid: false,
          error: 'Drive letter must be between A and Z'
        };
      }
    }
    
    // Check for UNC paths
    if (isUNCPath(inputPath)) {
      console.debug(`[CONFIG] Detected UNC path: "${inputPath}"`);
      // UNC paths are allowed but must be within project scope
    }
    
    // Resolve the input path to absolute
    let absolutePath;
    if (path.isAbsolute(inputPath)) {
      absolutePath = resolvePath(inputPath);
    } else {
      absolutePath = resolvePath(projectRoot, inputPath);
    }
    
    // Check if the path is within project scope
    const relativePath = path.relative(normalizedProjectRoot, absolutePath);
    
    // On Windows, check if paths are on different drives
    if (process.platform === 'win32') {
      const projectRootParsed = path.parse(normalizedProjectRoot);
      const absolutePathParsed = path.parse(absolutePath);
      
      // If roots are different (different drives), paths cannot be relative
      if (projectRootParsed.root.toLowerCase() !== absolutePathParsed.root.toLowerCase()) {
        return {
          isValid: false,
          error: `Game data directory must be on the same drive as project (project: ${projectRootParsed.root}, path: ${absolutePathParsed.root})`
        };
      }
    }
    
    // Path is outside project scope if relative path starts with '..' or is absolute
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return {
        isValid: false,
        error: 'Game data directory must be within project scope'
      };
    }
    
    // Convert to relative path for storage, always using forward slashes
    const relativeForStorage = './' + toForwardSlashes(relativePath);
    
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
 * Validate game mechanics configuration
 * @param {Object} gameMechanics - Game mechanics config object
 * @returns {Object} Validated config with defaults for invalid values
 */
function validateGameMechanics(gameMechanics) {
  const defaults = {
    overlapDetectionInterval: 1000,
    overlapThreshold: 0.6,
    doorAnimationFrameRate: 16
  };
  
  if (!gameMechanics || typeof gameMechanics !== 'object') {
    return defaults;
  }
  
  const validated = {};
  
  // Validate overlapDetectionInterval (positive number)
  if (typeof gameMechanics.overlapDetectionInterval === 'number' && 
      gameMechanics.overlapDetectionInterval > 0) {
    validated.overlapDetectionInterval = gameMechanics.overlapDetectionInterval;
  } else {
    validated.overlapDetectionInterval = defaults.overlapDetectionInterval;
    if (gameMechanics.overlapDetectionInterval !== undefined) {
      console.warn(`[CONFIG] Invalid overlapDetectionInterval: ${gameMechanics.overlapDetectionInterval}, using default: ${defaults.overlapDetectionInterval}ms`);
    }
  }
  
  // Validate overlapThreshold (0.0 to 1.0)
  if (typeof gameMechanics.overlapThreshold === 'number' && 
      gameMechanics.overlapThreshold >= 0.0 && 
      gameMechanics.overlapThreshold <= 1.0) {
    validated.overlapThreshold = gameMechanics.overlapThreshold;
  } else {
    validated.overlapThreshold = defaults.overlapThreshold;
    if (gameMechanics.overlapThreshold !== undefined) {
      console.warn(`[CONFIG] Invalid overlapThreshold: ${gameMechanics.overlapThreshold}, using default: ${defaults.overlapThreshold}`);
    }
  }
  
  // Validate doorAnimationFrameRate (positive number)
  if (typeof gameMechanics.doorAnimationFrameRate === 'number' && 
      gameMechanics.doorAnimationFrameRate > 0) {
    validated.doorAnimationFrameRate = gameMechanics.doorAnimationFrameRate;
  } else {
    validated.doorAnimationFrameRate = defaults.doorAnimationFrameRate;
    if (gameMechanics.doorAnimationFrameRate !== undefined) {
      console.warn(`[CONFIG] Invalid doorAnimationFrameRate: ${gameMechanics.doorAnimationFrameRate}, using default: ${defaults.doorAnimationFrameRate}ms`);
    }
  }
  
  return validated;
}
/**
 * Validate email system configuration
 * @param {Object} emailSystem - Email system config object
 * @returns {Object} Validated config with defaults for invalid values
 */
function validateEmailSystem(emailSystem) {
  const defaults = {
    welcomeButtonDelay: 10000,
    fileWatcherStabilityThreshold: 100
  };

  if (!emailSystem || typeof emailSystem !== 'object') {
    return defaults;
  }

  const validated = {};

  // Validate welcomeButtonDelay (non-negative number)
  if (typeof emailSystem.welcomeButtonDelay === 'number' &&
      emailSystem.welcomeButtonDelay >= 0) {
    validated.welcomeButtonDelay = emailSystem.welcomeButtonDelay;
  } else {
    validated.welcomeButtonDelay = defaults.welcomeButtonDelay;
    if (emailSystem.welcomeButtonDelay !== undefined) {
      console.warn(`[CONFIG] Invalid welcomeButtonDelay: ${emailSystem.welcomeButtonDelay}, using default: ${defaults.welcomeButtonDelay}ms`);
    }
  }

  // Validate fileWatcherStabilityThreshold (positive number)
  if (typeof emailSystem.fileWatcherStabilityThreshold === 'number' &&
      emailSystem.fileWatcherStabilityThreshold > 0) {
    validated.fileWatcherStabilityThreshold = emailSystem.fileWatcherStabilityThreshold;
  } else {
    validated.fileWatcherStabilityThreshold = defaults.fileWatcherStabilityThreshold;
    if (emailSystem.fileWatcherStabilityThreshold !== undefined) {
      console.warn(`[CONFIG] Invalid fileWatcherStabilityThreshold: ${emailSystem.fileWatcherStabilityThreshold}, using default: ${defaults.fileWatcherStabilityThreshold}ms`);
    }
  }

  return validated;
}

/**
 * Validate window dimensions configuration
 * @param {Object} windowDimensions - Window dimensions config object
 * @returns {Object} Validated config with defaults for invalid values
 */
function validateWindowDimensions(windowDimensions) {
  const defaults = {
    startMenu: { width: 600, height: 800 },
    emailWindow: { width: 1000, height: 700 },
    doorWindow: { width: 220, height: 320 },
    defaultFallback: { width: 800, height: 600 }
  };

  if (!windowDimensions || typeof windowDimensions !== 'object') {
    return defaults;
  }

  const validated = {};

  // Validate each window type
  for (const [windowType, defaultDims] of Object.entries(defaults)) {
    const dims = windowDimensions[windowType];

    if (!dims || typeof dims !== 'object') {
      validated[windowType] = defaultDims;
      continue;
    }

    validated[windowType] = {};

    // Validate width (>= 100)
    if (typeof dims.width === 'number' && dims.width >= 100) {
      validated[windowType].width = dims.width;
    } else {
      validated[windowType].width = defaultDims.width;
      if (dims.width !== undefined) {
        console.warn(`[CONFIG] Invalid ${windowType}.width: ${dims.width}, using default: ${defaultDims.width}px`);
      }
    }

    // Validate height (>= 100)
    if (typeof dims.height === 'number' && dims.height >= 100) {
      validated[windowType].height = dims.height;
    } else {
      validated[windowType].height = defaultDims.height;
      if (dims.height !== undefined) {
        console.warn(`[CONFIG] Invalid ${windowType}.height: ${dims.height}, using default: ${defaultDims.height}px`);
      }
    }
  }

  return validated;
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

      // Convert backslashes to forward slashes in gameDataDirectory path on load
      if (parsedConfig.gameDataDirectory && typeof parsedConfig.gameDataDirectory === 'string') {
        parsedConfig.gameDataDirectory = toForwardSlashes(parsedConfig.gameDataDirectory);
        console.debug(`[CONFIG] Normalized gameDataDirectory path: "${parsedConfig.gameDataDirectory}"`);
      }

      // Merge with defaults to ensure all required properties exist
      const config = { ...DEFAULT_CONFIG, ...parsedConfig };

      // Validate new configuration sections
      config.gameMechanics = validateGameMechanics(config.gameMechanics);
      config.emailSystem = validateEmailSystem(config.emailSystem);
      config.windowDimensions = validateWindowDimensions(config.windowDimensions);

      // Validate the loaded configuration
      const validation = validateConfiguration(config);

      if (validation.isValid) {
        console.log(`[CONFIG] Configuration loaded successfully`);
        return config;
      } else {
        console.warn(`[CONFIG] Invalid configuration file, using defaults: ${validation.error}`);
        const defaultConfig = { ...DEFAULT_CONFIG };
        defaultConfig.gameMechanics = validateGameMechanics(null);
        defaultConfig.emailSystem = validateEmailSystem(null);
        defaultConfig.windowDimensions = validateWindowDimensions(null);
        return defaultConfig;
      }

    } else {
      console.debug(`[CONFIG] No configuration file found, using defaults`);
      const defaultConfig = { ...DEFAULT_CONFIG };
      defaultConfig.gameMechanics = validateGameMechanics(null);
      defaultConfig.emailSystem = validateEmailSystem(null);
      defaultConfig.windowDimensions = validateWindowDimensions(null);
      return defaultConfig;
    }

  } catch (error) {
    console.error(`[CONFIG] Failed to load configuration:`, error);
    console.warn(`[CONFIG] Using default configuration`);
    const defaultConfig = { ...DEFAULT_CONFIG };
    defaultConfig.gameMechanics = validateGameMechanics(null);
    defaultConfig.emailSystem = validateEmailSystem(null);
    defaultConfig.windowDimensions = validateWindowDimensions(null);
    return defaultConfig;
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
 * Get game mechanics configuration
 * @returns {Object} Game mechanics config with validated values
 */
export function getGameMechanicsConfig() {
  const config = getConfig();
  return config.gameMechanics || validateGameMechanics(null);
}
/**
 * Get email system configuration
 * @returns {Object} Email system config with validated values
 */
export function getEmailSystemConfig() {
  const config = getConfig();
  return config.emailSystem || validateEmailSystem(null);
}

/**
 * Get window dimensions configuration
 * @returns {Object} Window dimensions config with validated values
 */
export function getWindowDimensionsConfig() {
  const config = getConfig();
  return config.windowDimensions || validateWindowDimensions(null);
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