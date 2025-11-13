import fs from 'node:fs';
import path from 'node:path';
import {
  getWindow,
  createWindow,
  createPicture,
  createContentWindow,
  createLensWindow
} from './windowManager.js';
import { getLensSystemInfo } from './lensSystem.js';
import '../../logger.js';

// Storage configuration
const STORAGE_DIR = '.fenestra-storage';
const FILE_EXTENSION = '.fenestra';
const STORAGE_VERSION = '1.0';
const STORAGE_PATH = '/Users/ericzhong/Documents/GitHub/Fenestra/game-data'

/**
 * Ensure storage directory exists
 * @returns {string} Storage directory path
 */
export function ensureStorageDirectory() {
  // const storageDir = path.join(process.cwd(), STORAGE_DIR);
  const storageDir = path.join(STORAGE_PATH, STORAGE_DIR)

  if (!fs.existsSync(storageDir)) {
    try {
      fs.mkdirSync(storageDir, { recursive: true });
      console.log(`[STORAGE] Created storage directory: ${storageDir}`);
    } catch (error) {
      console.error(`[STORAGE] Failed to create storage directory:`, error);
      throw new Error(`Failed to create storage directory: ${error.message}`);
    }
  }

  return storageDir;
}

/**
 * Get storage directory path
 * @returns {string} Storage directory path
 */
export function getStorageDirectory() {
  return path.join(STORAGE_PATH, STORAGE_DIR);
}

/**
 * Extract window data for serialization
 * @param {string} windowId - Window ID
 * @returns {Object|null} Window serialization data
 */
export function getWindowSerializationData(windowId) {
  console.debug(`[STORAGE] Extracting serialization data for window: ${windowId}`);

  const win = getWindow(windowId);
  if (!win || win.isDestroyed()) {
    console.warn(`[STORAGE] Window ${windowId} not found or destroyed`);
    return null;
  }



  try {
    // Get basic window properties
    const bounds = win.getBounds();
    const title = win.getTitle();

    // Determine window type and extract specific properties
    const windowType = determineWindowType(windowId, win);
    const contentConfig = extractContentConfig(windowId, win, windowType);
    const specialConfig = extractSpecialConfig(windowId, win, windowType);

    const serializationData = {
      windowConfig: {
        id: windowId,
        title: title,
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        },
        properties: {
          resizable: win.isResizable(),
          transparent: win.isTransparent ? win.isTransparent() : false,
          alwaysOnTop: win.isAlwaysOnTop(),
          opacity: win.getOpacity ? win.getOpacity() : 1.0,
          visible: win.isVisible(),
          minimized: win.isMinimized(),
          maximized: win.isMaximized()
        }
      },
      contentConfig: contentConfig,
      specialConfig: specialConfig,
      windowType: windowType
    };

    console.debug(`[STORAGE] Successfully extracted data for window ${windowId}, type: ${windowType}`);
    return serializationData;

  } catch (error) {
    console.error(`[STORAGE] Error extracting window data for ${windowId}:`, error);
    return null;
  }
}

/**
 * Determine window type based on ID and properties
 * @param {string} windowId - Window ID
 * @param {BrowserWindow} win - Window object
 * @returns {string} Window type
 */
function determineWindowType(windowId, win) {
  // Check for specific window types based on ID patterns
  if (windowId.startsWith('door')) return 'door';
  if (windowId.startsWith('key')) return 'key';
  if (windowId.startsWith('picture')) return 'picture';
  if (windowId.startsWith('content')) return 'content';
  if (windowId.startsWith('lens')) return 'lens';
  if (windowId === 'terminal') return 'terminal';
  if (windowId === 'desktop') return 'desktop';
  if (windowId === 'video') return 'video';

  // Try to determine from URL
  try {
    const url = win.webContents.getURL();
    if (url.includes('pictureViewer.html')) return 'picture';
    if (url.includes('contentViewer.html')) return 'content';
    if (url.includes('lensViewer.html')) return 'lens';
    if (url.includes('terminal.html')) return 'terminal';
  } catch (error) {
    console.debug(`[STORAGE] Could not get URL for window ${windowId}:`, error.message);
  }

  return 'generic';
}

/**
 * Extract content configuration from window
 * @param {string} windowId - Window ID
 * @param {BrowserWindow} win - Window object
 * @param {string} windowType - Window type
 * @returns {Object} Content configuration
 */
function extractContentConfig(windowId, win, windowType) {
  const contentConfig = {
    htmlName: 'index.html',
    otherContents: {},
    type: 'text',
    path: '',
    surfaceContent: '',
    hiddenContent: '',
    blurAmount: 0,
    blurred: false
  };

  try {
    const url = win.webContents.getURL();

    if (url.includes('?')) {
      const urlObj = new URL(url);
      const params = urlObj.searchParams;

      // Extract HTML file name from URL
      const pathname = urlObj.pathname;
      if (pathname) {
        const htmlFile = path.basename(pathname);
        if (htmlFile && htmlFile.endsWith('.html')) {
          contentConfig.htmlName = htmlFile;
        }
      }

      // Extract query parameters
      contentConfig.type = params.get('type') || 'text';
      contentConfig.path = params.get('path') || params.get('imagePath') || '';
      contentConfig.surfaceContent = params.get('surfaceContent') || '';
      contentConfig.hiddenContent = params.get('hiddenContent') || '';
      contentConfig.blurAmount = parseInt(params.get('blur')) || 0;
      contentConfig.blurred = params.get('blurred') === 'true';

      // Store all other parameters
      for (const [key, value] of params) {
        if (!['type', 'path', 'imagePath', 'surfaceContent', 'hiddenContent', 'blur', 'blurred', 'id'].includes(key)) {
          contentConfig.otherContents[key] = value;
        }
      }
    }

  } catch (error) {
    console.debug(`[STORAGE] Could not extract content config for ${windowId}:`, error.message);
  }

  return contentConfig;
}

/**
 * Extract special configuration based on window type
 * @param {string} windowId - Window ID
 * @param {BrowserWindow} win - Window object
 * @param {string} windowType - Window type
 * @returns {Object} Special configuration
 */
function extractSpecialConfig(windowId, win, windowType) {
  const specialConfig = {};

  try {
    switch (windowType) {
      case 'picture':
      case 'door':
        const url = win.webContents.getURL();
        if (url.includes('?')) {
          const urlObj = new URL(url);
          const params = urlObj.searchParams;

          specialConfig.pictureSettings = {
            imagePath: params.get('imagePath') || params.get('path') || '',
            fitMode: params.get('fitMode') || 'fill'
          };
        }
        break;

      case 'lens':
        // Get lens system information
        const lensInfo = getLensSystemInfo(windowId);
        if (lensInfo) {
          specialConfig.lensSettings = {
            targetWindowId: lensInfo.targetWindowId,
            isLens: true,
            isTracking: lensInfo.isTracking || false
          };
        }
        break;

      case 'door':
      case 'key':
        specialConfig.doorKeySettings = {
          isDoor: windowType === 'door',
          isKey: windowType === 'key',
          encrypted: false, // TODO: Extract from actual door/key state
          relatedItems: [] // TODO: Extract related doors/keys
        };
        break;

      case 'content':
        // Content-specific settings are already in contentConfig
        break;
    }

  } catch (error) {
    console.debug(`[STORAGE] Could not extract special config for ${windowId}:`, error.message);
  }

  return specialConfig;
}

/**
 * Serialize window data to JSON format
 * @param {string} windowId - Window ID
 * @returns {Object|null} Serialized window data
 */
export function serializeWindow(windowId) {
  console.debug(`[STORAGE] Serializing window: ${windowId}`);

  const windowData = getWindowSerializationData(windowId);
  if (!windowData) {
    return null;
  }

  // Create serialization object with metadata
  const serializedData = {
    version: STORAGE_VERSION,
    timestamp: new Date().toISOString(),
    metadata: {
      originalId: windowId,
      windowType: windowData.windowType,
      description: `${windowData.windowType} window: ${windowData.windowConfig.title}`
    },
    windowConfig: windowData.windowConfig,
    contentConfig: windowData.contentConfig,
    specialConfig: windowData.specialConfig
  };

  console.debug(`[STORAGE] Successfully serialized window ${windowId}`);
  return serializedData;
}

/**
 * Generate filename for saved window
 * @param {string} windowId - Window ID
 * @param {string} windowType - Window type
 * @param {string} customName - Custom filename (optional)
 * @returns {string} Generated filename
 */
function generateFilename(windowId, windowType, customName = null) {
  if (customName) {
    // Ensure custom name has correct extension
    return customName.endsWith(FILE_EXTENSION) ? customName : `${customName}`;
  }

  const isoString = new Date().toISOString();
  const timestamp = isoString.replace(/[:.]/g, '-').split('T')[0] + 'T' +
    isoString.replace(/[:.]/g, '-').split('T')[1].split('-')[0];

  return `${windowType}-${windowId}-${timestamp}`;
}

/**
 * Save window to file
 * @param {string} windowId - Window ID
 * @param {string} customPath - Custom file path (optional)
 * @returns {Object} Operation result
 */
export function saveWindowToFile(windowId, customPath = null) {
  console.log(`[STORAGE] Saving window ${windowId} to file`);

  try {
    const serializedData = serializeWindow(windowId);
    if (!serializedData) {
      return { success: false, message: `Failed to serialize window ${windowId}` };
    }

    const storageDir = ensureStorageDirectory();

    let filePath;
    if (customPath) {
      // Use custom path (can be absolute or relative to storage dir)
      if (path.isAbsolute(customPath)) {
        filePath = customPath;
      } else {
        filePath = path.join(storageDir, customPath);
      }
    } else {
      // Generate automatic filename
      const filename = generateFilename(windowId, serializedData.metadata.windowType);
      filePath = path.join(storageDir, filename);
    }

    // Ensure directory exists for the file path
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    // Write file with proper formatting
    const jsonString = JSON.stringify(serializedData, null, 2);
    filePath += ".fenestra";
    fs.writeFileSync(filePath, jsonString, 'utf8');

    console.log(`[STORAGE] Successfully saved window ${windowId} to: ${filePath}`);
    return {
      success: true,
      message: `Window ${windowId} saved successfully`,
      filePath: filePath,
      filename: path.basename(filePath)
    };

  } catch (error) {
    console.error(`[STORAGE] Error saving window ${windowId}:`, error);
    return {
      success: false,
      message: `Failed to save window: ${error.message}`
    };
  }
}

/**
 * Validate window data structure
 * @param {Object} data - Window data to validate
 * @returns {Object} Validation result
 */
export function validateWindowData(data) {
  console.debug(`[STORAGE] Validating window data`);

  const errors = [];

  // Check required top-level fields
  if (!data.version) errors.push('Missing version field');
  if (!data.timestamp) errors.push('Missing timestamp field');
  if (!data.metadata) errors.push('Missing metadata field');
  if (!data.windowConfig) errors.push('Missing windowConfig field');

  // Check metadata
  if (data.metadata) {
    if (!data.metadata.originalId) errors.push('Missing metadata.originalId');
    if (!data.metadata.windowType) errors.push('Missing metadata.windowType');
  }

  // Check window config
  if (data.windowConfig) {
    if (!data.windowConfig.id) errors.push('Missing windowConfig.id');
    if (!data.windowConfig.bounds) errors.push('Missing windowConfig.bounds');

    if (data.windowConfig.bounds) {
      const bounds = data.windowConfig.bounds;
      if (typeof bounds.x !== 'number') errors.push('Invalid bounds.x');
      if (typeof bounds.y !== 'number') errors.push('Invalid bounds.y');
      if (typeof bounds.width !== 'number' || bounds.width <= 0) errors.push('Invalid bounds.width');
      if (typeof bounds.height !== 'number' || bounds.height <= 0) errors.push('Invalid bounds.height');
    }
  }

  // Version compatibility check
  if (data.version && data.version !== STORAGE_VERSION) {
    errors.push(`Version mismatch: expected ${STORAGE_VERSION}, got ${data.version}`);
  }

  const isValid = errors.length === 0;

  if (isValid) {
    console.debug(`[STORAGE] Window data validation passed`);
  } else {
    console.warn(`[STORAGE] Window data validation failed:`, errors);
  }

  return {
    isValid,
    errors,
    warnings: isValid ? [] : ['Data validation failed']
  };
}

/**
 * Load and parse window data from file
 * @param {string} filePath - Path to .fenestra file
 * @returns {Object} Load result with parsed data
 */
export function loadWindowFromFile(filePath) {
  console.log(`[STORAGE] Loading window from file: ${filePath}`);

  try {
    // Resolve file path
    let fullPath;
    if (path.isAbsolute(filePath)) {
      fullPath = filePath;
    } else {
      // Try relative to storage directory first, then current directory
      const storageDir = getStorageDirectory();
      const storagePath = path.join(storageDir, filePath);

      if (fs.existsSync(storagePath)) {
        fullPath = storagePath;
      } else {
        fullPath = path.join(process.cwd(), filePath);
      }
    }

    // Check file exists
    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        message: `File not found: ${filePath}`
      };
    }

    // Check file extension
    if (!fullPath.endsWith(FILE_EXTENSION)) {
      return {
        success: false,
        message: `Invalid file extension. Expected ${FILE_EXTENSION}`
      };
    }

    // Read and parse file
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    let windowData;

    try {
      windowData = JSON.parse(fileContent);
    } catch (parseError) {
      return {
        success: false,
        message: `Invalid JSON format: ${parseError.message}`
      };
    }

    // Validate data structure
    const validation = validateWindowData(windowData);
    if (!validation.isValid) {
      return {
        success: false,
        message: `Invalid window data: ${validation.errors.join(', ')}`,
        errors: validation.errors
      };
    }

    console.log(`[STORAGE] Successfully loaded window data from: ${fullPath}`);
    return {
      success: true,
      message: `Window data loaded successfully`,
      data: windowData,
      filePath: fullPath
    };

  } catch (error) {
    console.error(`[STORAGE] Error loading window from file:`, error);
    return {
      success: false,
      message: `Failed to load file: ${error.message}`
    };
  }
}

/**
 * List all stored window files
 * @returns {Object} List result
 */
export function listStoredWindows() {
  console.debug(`[STORAGE] Listing stored windows`);

  try {
    const storageDir = getStorageDirectory();

    if (!fs.existsSync(storageDir)) {
      return {
        success: true,
        message: 'No storage directory found',
        files: []
      };
    }

    const files = fs.readdirSync(storageDir)
      .filter(file => file.endsWith(FILE_EXTENSION))
      .map(file => {
        const filePath = path.join(storageDir, file);
        const stats = fs.statSync(filePath);

        return {
          filename: file,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime
        };
      })
      .sort((a, b) => b.modified - a.modified); // Sort by modification time, newest first

    console.debug(`[STORAGE] Found ${files.length} stored window files`);
    return {
      success: true,
      message: `Found ${files.length} stored window files`,
      files: files
    };

  } catch (error) {
    console.error(`[STORAGE] Error listing stored windows:`, error);
    return {
      success: false,
      message: `Failed to list files: ${error.message}`,
      files: []
    };
  }
}

/**
 * Delete a stored window file
 * @param {string} filename - Filename to delete
 * @returns {Object} Delete result
 */
export function deleteStoredWindow(filename) {
  console.log(`[STORAGE] Deleting stored window: ${filename}`);

  try {
    const storageDir = getStorageDirectory();
    const filePath = path.join(storageDir, filename);

    if (!fs.existsSync(filePath)) {
      return {
        success: false,
        message: `File not found: ${filename}`
      };
    }

    if (!filename.endsWith(FILE_EXTENSION)) {
      return {
        success: false,
        message: `Invalid file extension. Expected ${FILE_EXTENSION}`
      };
    }

    fs.unlinkSync(filePath);

    console.log(`[STORAGE] Successfully deleted: ${filename}`);
    return {
      success: true,
      message: `File ${filename} deleted successfully`
    };

  } catch (error) {
    console.error(`[STORAGE] Error deleting file:`, error);
    return {
      success: false,
      message: `Failed to delete file: ${error.message}`
    };
  }
}
/**

 * Deserialize and recreate window from data
 * @param {Object} windowData - Parsed window data
 * @param {Object} options - Recreation options
 * @returns {Object} Recreation result
 */
export function deserializeWindow(windowData, options = {}) {
  console.log(`[STORAGE] Deserializing window: ${windowData.metadata.originalId}`);

  try {
    const {
      forceNewId = false,
      customId = null,
      skipContentValidation = false
    } = options;

    // Determine window ID for recreation
    let targetId = customId || windowData.windowConfig.id;

    // Check if window already exists
    const existingWindow = getWindow(targetId);
    if (existingWindow && !existingWindow.isDestroyed()) {
      if (forceNewId) {
        // Generate new ID
        targetId = `${targetId}-restored-${Date.now()}`;
        console.log(`[STORAGE] Window ${windowData.windowConfig.id} exists, using new ID: ${targetId}`);
      } else {
        return {
          success: false,
          message: `Window ${targetId} already exists. Use forceNewId option to create with new ID.`
        };
      }
    }

    // Validate content files if needed
    if (!skipContentValidation) {
      const contentValidation = validateContentFiles(windowData);
      if (!contentValidation.isValid) {
        console.warn(`[STORAGE] Content validation warnings:`, contentValidation.warnings);
        // Continue with warnings but log them
      }
    }

    // Recreate window based on type
    const result = recreateWindowByType(targetId, windowData);

    if (result.success) {
      console.log(`[STORAGE] Successfully recreated window: ${targetId}`);
      return {
        success: true,
        message: `Window ${targetId} recreated successfully`,
        windowId: targetId,
        warnings: result.warnings || []
      };
    } else {
      return result;
    }

  } catch (error) {
    console.error(`[STORAGE] Error deserializing window:`, error);
    return {
      success: false,
      message: `Failed to recreate window: ${error.message}`
    };
  }
}

/**
 * Validate content files referenced in window data
 * @param {Object} windowData - Window data to validate
 * @returns {Object} Validation result
 */
function validateContentFiles(windowData) {
  const warnings = [];
  let isValid = true;

  try {
    const { contentConfig, specialConfig } = windowData;

    // Check content paths
    if (contentConfig && contentConfig.path) {
      const contentPath = contentConfig.path;
      if (contentPath && !contentPath.startsWith('http')) {
        // Check if local file exists
        const fullPath = path.isAbsolute(contentPath)
          ? contentPath
          : path.join(process.cwd(), contentPath);

        if (!fs.existsSync(fullPath)) {
          warnings.push(`Content file not found: ${contentPath}`);
        }
      }
    }

    // Check picture paths
    if (specialConfig && specialConfig.pictureSettings) {
      const imagePath = specialConfig.pictureSettings.imagePath;
      if (imagePath && !imagePath.startsWith('http')) {
        const fullPath = path.isAbsolute(imagePath)
          ? imagePath
          : path.join(process.cwd(), imagePath);

        if (!fs.existsSync(fullPath)) {
          warnings.push(`Image file not found: ${imagePath}`);
        }
      }
    }

  } catch (error) {
    console.debug(`[STORAGE] Content validation error:`, error.message);
    warnings.push(`Content validation error: ${error.message}`);
  }

  return { isValid, warnings };
}

/**
 * Recreate window based on its type
 * @param {string} windowId - Target window ID
 * @param {Object} windowData - Window data
 * @returns {Object} Recreation result
 */
function recreateWindowByType(windowId, windowData) {
  const { metadata, windowConfig } = windowData;
  const windowType = metadata.windowType;

  console.debug(`[STORAGE] Recreating ${windowType} window: ${windowId}`);

  try {
    let createdWindow = null;
    const warnings = [];

    switch (windowType) {
      case 'picture':
      case 'door':
        createdWindow = recreatePictureWindow(windowId, windowData);
        break;

      case 'content':
        createdWindow = recreateContentWindow(windowId, windowData);
        break;

      case 'lens':
        const lensResult = recreateLensWindow(windowId, windowData);
        if (!lensResult.success) {
          return lensResult;
        }
        createdWindow = lensResult.window;
        warnings.push(...(lensResult.warnings || []));
        break;

      case 'terminal':
      case 'desktop':
      case 'video':
      case 'key':
      case 'generic':
      default:
        createdWindow = recreateGenericWindow(windowId, windowData);
        break;
    }

    if (!createdWindow) {
      return { success: false, message: `Failed to create ${windowType} window` };
    }

    // Apply window properties after creation
    applyWindowProperties(createdWindow, windowConfig);

    return {
      success: true,
      window: createdWindow,
      warnings: warnings
    };

  } catch (error) {
    console.error(`[STORAGE] Error recreating ${windowType} window:`, error);
    return {
      success: false,
      message: `Failed to recreate ${windowType} window: ${error.message}`
    };
  }
}

/**
 * Recreate picture window (including doors)
 * @param {string} windowId - Window ID
 * @param {Object} windowData - Window data
 * @returns {BrowserWindow|null} Created window
 */
function recreatePictureWindow(windowId, windowData) {
  const { windowConfig, specialConfig } = windowData;

  let imagePath = 'doors/Door.png'; // Default
  let fitMode = 'fill';

  if (specialConfig && specialConfig.pictureSettings) {
    imagePath = specialConfig.pictureSettings.imagePath || imagePath;
    fitMode = specialConfig.pictureSettings.fitMode || fitMode;
  }

  const { bounds } = windowConfig;

  return createPicture(
    windowId,
    imagePath,
    fitMode,
    windowConfig.title,
    bounds.width,
    bounds.height
  );
}

/**
 * Recreate content window
 * @param {string} windowId - Window ID
 * @param {Object} windowData - Window data
 * @returns {BrowserWindow|null} Created window
 */
function recreateContentWindow(windowId, windowData) {
  const { windowConfig, contentConfig } = windowData;
  const { bounds } = windowConfig;

  const options = {
    contentType: contentConfig.type || 'text',
    contentPath: contentConfig.path || '',
    blurAmount: contentConfig.blurAmount || 10,
    blurred: contentConfig.blurred !== false,
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: windowConfig.title
  };

  const result = createContentWindow(windowId, options);

  if (result.success) {
    return getWindow(windowId);
  }

  return null;
}

/**
 * Recreate lens window
 * @param {string} windowId - Window ID
 * @param {Object} windowData - Window data
 * @returns {Object} Recreation result with window and warnings
 */
function recreateLensWindow(windowId, windowData) {
  const { windowConfig, contentConfig, specialConfig } = windowData;
  const { bounds } = windowConfig;
  const warnings = [];

  let targetWindowId = null;

  if (specialConfig && specialConfig.lensSettings) {
    targetWindowId = specialConfig.lensSettings.targetWindowId;
  }

  if (!targetWindowId) {
    return {
      success: false,
      message: 'Lens window requires target window ID'
    };
  }

  // Check if target window exists
  const targetWindow = getWindow(targetWindowId);
  if (!targetWindow || targetWindow.isDestroyed()) {
    warnings.push(`Target window ${targetWindowId} not found. Lens may not function correctly.`);
    // Continue creation anyway - lens will be created but won't function until target exists
  }

  const options = {
    contentType: contentConfig.type || 'text',
    contentPath: contentConfig.path || '',
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y
  };

  const result = createLensWindow(windowId, targetWindowId, options);

  if (result.success) {
    return {
      success: true,
      window: getWindow(windowId),
      warnings: warnings
    };
  }

  return {
    success: false,
    message: result.message,
    warnings: warnings
  };
}

/**
 * Recreate generic window
 * @param {string} windowId - Window ID
 * @param {Object} windowData - Window data
 * @returns {BrowserWindow|null} Created window
 */
function recreateGenericWindow(windowId, windowData) {
  const { windowConfig, contentConfig } = windowData;
  const { bounds } = windowConfig;

  const options = {
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: windowConfig.title,
    resizable: windowConfig.properties.resizable !== false,
    transparent: windowConfig.properties.transparent === true
  };

  // Use HTML name from content config if available
  if (contentConfig && contentConfig.htmlName) {
    options.otherContents = contentConfig.htmlName;

    // Add other content parameters
    if (contentConfig.otherContents && Object.keys(contentConfig.otherContents).length > 0) {
      options.otherContents = {
        ...contentConfig.otherContents,
        htmlName: contentConfig.htmlName
      };
    }
  }

  return createWindow(windowId, options);
}

/**
 * Apply window properties after creation
 * @param {BrowserWindow} win - Window object
 * @param {Object} windowConfig - Window configuration
 */
function applyWindowProperties(win, windowConfig) {
  if (!win || win.isDestroyed()) {
    return;
  }

  try {
    const { bounds, properties } = windowConfig;

    // Set bounds
    if (bounds) {
      win.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      });
    }

    // Apply properties
    if (properties) {
      if (typeof properties.resizable === 'boolean') {
        win.setResizable(properties.resizable);
      }

      if (typeof properties.alwaysOnTop === 'boolean') {
        win.setAlwaysOnTop(properties.alwaysOnTop);
      }

      if (typeof properties.opacity === 'number' && win.setOpacity) {
        win.setOpacity(Math.max(0, Math.min(1, properties.opacity)));
      }

      if (typeof properties.visible === 'boolean') {
        if (properties.visible) {
          win.show();
        } else {
          win.hide();
        }
      }

      if (properties.minimized === true) {
        win.minimize();
      } else if (properties.maximized === true) {
        win.maximize();
      }
    }

    console.debug(`[STORAGE] Applied window properties for ${windowConfig.id}`);

  } catch (error) {
    console.error(`[STORAGE] Error applying window properties:`, error);
  }
}

/**
 * Convert absolute paths to relative paths for portability
 * @param {string} filePath - File path to convert
 * @returns {string} Relative path if possible, original path otherwise
 */
export function makePathRelative(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }

  try {
    const cwd = process.cwd();

    if (path.isAbsolute(filePath) && filePath.startsWith(cwd)) {
      const relativePath = path.relative(cwd, filePath);
      console.debug(`[STORAGE] Converted absolute path to relative: ${filePath} -> ${relativePath}`);
      return relativePath;
    }

    return filePath;
  } catch (error) {
    console.debug(`[STORAGE] Could not convert path to relative: ${error.message}`);
    return filePath;
  }
}

/**
 * Resolve relative paths to absolute paths
 * @param {string} filePath - File path to resolve
 * @returns {string} Absolute path
 */
export function resolveRelativePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return filePath;
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.join(process.cwd(), filePath);
}