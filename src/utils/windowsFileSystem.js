/**
 * Windows-specific file system handling utilities
 * Provides Windows-specific functionality for file operations including:
 * - Long path handling (MAX_PATH)
 * - Case-insensitive file existence checking
 * - Windows ACL permission checking
 * - Symlink/junction resolution
 * - Hidden and system file handling
 * @module windowsFileSystem
 */

import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

// Platform detection
const isWindows = process.platform === 'win32';

// Windows constants
const MAX_PATH = 260;
const LONG_PATH_PREFIX = '\\\\?\\';
const UNC_LONG_PATH_PREFIX = '\\\\?\\UNC\\';

// File attribute constants for Windows
const FILE_ATTRIBUTE_HIDDEN = 0x2;
const FILE_ATTRIBUTE_SYSTEM = 0x4;
const FILE_ATTRIBUTE_DIRECTORY = 0x10;

/**
 * Checks if a file exists with case-insensitive matching on Windows
 * @param {string} filePath - Path to check
 * @returns {Promise<Object>} Result with exists flag and actual path if found
 * 
 * @example
 * const result = await checkFileExistsCaseInsensitive('C:\\Users\\test\\FILE.txt');
 * // { exists: true, actualPath: 'C:\\Users\\test\\file.txt' }
 */
export async function checkFileExistsCaseInsensitive(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return { exists: false, actualPath: null, error: 'Invalid file path' };
  }

  try {
    // On non-Windows platforms, just check existence normally
    if (!isWindows) {
      const exists = fs.existsSync(filePath);
      return { 
        exists, 
        actualPath: exists ? filePath : null,
        error: null
      };
    }

    // On Windows, perform case-insensitive check
    const normalizedPath = path.normalize(filePath);
    
    // First check if the path exists as-is
    if (fs.existsSync(normalizedPath)) {
      return { 
        exists: true, 
        actualPath: normalizedPath,
        error: null
      };
    }

    // If not found, try to find it with different casing
    const dirname = path.dirname(normalizedPath);
    const basename = path.basename(normalizedPath);

    // Check if parent directory exists
    if (!fs.existsSync(dirname)) {
      return { 
        exists: false, 
        actualPath: null,
        error: 'Parent directory does not exist'
      };
    }

    // Read directory and compare case-insensitively
    const files = fs.readdirSync(dirname);
    const matchingFile = files.find(
      file => file.toLowerCase() === basename.toLowerCase()
    );

    if (matchingFile) {
      const actualPath = path.join(dirname, matchingFile);
      return { 
        exists: true, 
        actualPath,
        error: null
      };
    }

    return { 
      exists: false, 
      actualPath: null,
      error: 'File not found'
    };

  } catch (error) {
    return { 
      exists: false, 
      actualPath: null,
      error: error.message
    };
  }
}

/**
 * Handles long paths on Windows by adding the \\?\ prefix when needed
 * @param {string} inputPath - Path to process
 * @returns {Object} Result with processed path and whether long path prefix was added
 * 
 * @example
 * const result = handleLongPath('C:\\very\\long\\path\\...');
 * // { path: '\\\\?\\C:\\very\\long\\path\\...', isLongPath: true, error: null }
 */
export function handleLongPath(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return { 
      path: inputPath, 
      isLongPath: false, 
      error: 'Invalid input path',
      exceedsMaxPath: false
    };
  }

  // Only apply on Windows
  if (!isWindows) {
    return { 
      path: inputPath, 
      isLongPath: false, 
      error: null,
      exceedsMaxPath: false
    };
  }

  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(inputPath);
    const pathLength = absolutePath.length;
    const exceedsMaxPath = pathLength >= MAX_PATH;

    // If path already has long path prefix, return as-is
    if (absolutePath.startsWith(LONG_PATH_PREFIX)) {
      return { 
        path: absolutePath, 
        isLongPath: true, 
        error: null,
        exceedsMaxPath
      };
    }

    // If path is under MAX_PATH, no need for prefix
    if (pathLength < MAX_PATH) {
      return { 
        path: absolutePath, 
        isLongPath: false, 
        error: null,
        exceedsMaxPath: false
      };
    }

    // Add long path prefix for paths exceeding MAX_PATH
    // Handle UNC paths differently
    if (absolutePath.startsWith('\\\\')) {
      // UNC path: \\server\share -> \\?\UNC\server\share
      const uncPath = absolutePath.substring(2); // Remove leading \\
      const longPath = UNC_LONG_PATH_PREFIX + uncPath;
      return { 
        path: longPath, 
        isLongPath: true, 
        error: null,
        exceedsMaxPath: true
      };
    } else {
      // Regular path: C:\path -> \\?\C:\path
      const longPath = LONG_PATH_PREFIX + absolutePath;
      return { 
        path: longPath, 
        isLongPath: true, 
        error: null,
        exceedsMaxPath: true
      };
    }

  } catch (error) {
    return { 
      path: inputPath, 
      isLongPath: false, 
      error: error.message,
      exceedsMaxPath: false
    };
  }
}

/**
 * Checks Windows ACL permissions for a file or directory
 * @param {string} targetPath - Path to check permissions for
 * @returns {Promise<Object>} Permission information
 * 
 * @example
 * const perms = await checkWindowsPermissions('C:\\Users\\test\\file.txt');
 * // { readable: true, writable: true, executable: false, error: null }
 */
export async function checkWindowsPermissions(targetPath) {
  if (!targetPath || typeof targetPath !== 'string') {
    return {
      readable: false,
      writable: false,
      executable: false,
      error: 'Invalid target path'
    };
  }

  try {
    // Check if path exists
    if (!fs.existsSync(targetPath)) {
      return {
        readable: false,
        writable: false,
        executable: false,
        error: 'Path does not exist'
      };
    }

    const permissions = {
      readable: false,
      writable: false,
      executable: false,
      error: null
    };

    // Check read permission
    try {
      fs.accessSync(targetPath, fs.constants.R_OK);
      permissions.readable = true;
    } catch (err) {
      // Read permission denied
    }

    // Check write permission
    try {
      fs.accessSync(targetPath, fs.constants.W_OK);
      permissions.writable = true;
    } catch (err) {
      // Write permission denied
    }

    // Check execute permission (on Windows, this is less meaningful)
    try {
      fs.accessSync(targetPath, fs.constants.X_OK);
      permissions.executable = true;
    } catch (err) {
      // Execute permission denied
    }

    // On Windows, also check if file is read-only via attributes
    if (isWindows) {
      try {
        const stats = fs.statSync(targetPath);
        // On Windows, check the mode for read-only flag
        // If writable bit is not set, it's read-only
        const mode = stats.mode;
        const isReadOnly = (mode & 0o200) === 0; // Owner write bit
        
        if (isReadOnly) {
          permissions.writable = false;
        }
      } catch (err) {
        // Ignore stat errors
      }
    }

    return permissions;

  } catch (error) {
    return {
      readable: false,
      writable: false,
      executable: false,
      error: error.message
    };
  }
}

/**
 * Resolves Windows symlinks and junctions to their target paths
 * @param {string} linkPath - Path to the symlink or junction
 * @returns {Promise<Object>} Resolution result with target path
 * 
 * @example
 * const result = await resolveSymlink('C:\\Users\\link');
 * // { isSymlink: true, targetPath: 'C:\\Users\\actual', error: null }
 */
export async function resolveSymlink(linkPath) {
  if (!linkPath || typeof linkPath !== 'string') {
    return {
      isSymlink: false,
      isJunction: false,
      targetPath: null,
      error: 'Invalid link path'
    };
  }

  try {
    // Check if path exists
    if (!fs.existsSync(linkPath)) {
      return {
        isSymlink: false,
        isJunction: false,
        targetPath: null,
        error: 'Path does not exist'
      };
    }

    // Get lstat to check if it's a symbolic link
    const lstat = fs.lstatSync(linkPath);
    
    if (!lstat.isSymbolicLink()) {
      return {
        isSymlink: false,
        isJunction: false,
        targetPath: linkPath,
        error: null
      };
    }

    // Read the symlink target
    const targetPath = fs.readlinkSync(linkPath);
    
    // Resolve to absolute path if relative
    const absoluteTarget = path.isAbsolute(targetPath) 
      ? targetPath 
      : path.resolve(path.dirname(linkPath), targetPath);

    // On Windows, determine if it's a junction or symlink
    // Junctions are directory symlinks on Windows
    const isJunction = isWindows && lstat.isDirectory();

    return {
      isSymlink: true,
      isJunction,
      targetPath: absoluteTarget,
      error: null
    };

  } catch (error) {
    return {
      isSymlink: false,
      isJunction: false,
      targetPath: null,
      error: error.message
    };
  }
}

/**
 * Reads directory contents including hidden and system files on Windows
 * @param {string} dirPath - Directory path to read
 * @param {Object} options - Options for filtering
 * @param {boolean} options.includeHidden - Include hidden files (default: true)
 * @param {boolean} options.includeSystem - Include system files (default: true)
 * @returns {Promise<Object>} Directory contents with file information
 * 
 * @example
 * const result = await readDirectoryWithHidden('C:\\Users\\test');
 * // { files: [...], error: null }
 */
export async function readDirectoryWithHidden(dirPath, options = {}) {
  const {
    includeHidden = true,
    includeSystem = true
  } = options;

  if (!dirPath || typeof dirPath !== 'string') {
    return {
      files: [],
      error: 'Invalid directory path'
    };
  }

  try {
    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      return {
        files: [],
        error: 'Directory does not exist'
      };
    }

    // Check if it's actually a directory
    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      return {
        files: [],
        error: 'Path is not a directory'
      };
    }

    // Read directory contents
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    const files = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      try {
        const entryStats = fs.statSync(fullPath);
        
        const fileInfo = {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          isSymbolicLink: entry.isSymbolicLink(),
          size: entryStats.size,
          modified: entryStats.mtime,
          created: entryStats.birthtime,
          isHidden: false,
          isSystem: false
        };

        // On Windows, detect hidden and system files
        if (isWindows) {
          // Files starting with . are considered hidden on all platforms
          if (entry.name.startsWith('.')) {
            fileInfo.isHidden = true;
          }

          // On Windows, we can't easily detect hidden/system attributes without native modules
          // But we can use common patterns:
          // - Files/folders starting with . are hidden
          // - Common system folders
          const systemFolders = new Set([
            '$Recycle.Bin', 'System Volume Information', 
            'Recovery', 'ProgramData', 'Windows'
          ]);
          
          if (systemFolders.has(entry.name)) {
            fileInfo.isSystem = true;
          }
        } else {
          // On Unix-like systems, files starting with . are hidden
          if (entry.name.startsWith('.')) {
            fileInfo.isHidden = true;
          }
        }

        // Apply filters
        if (!includeHidden && fileInfo.isHidden) {
          continue;
        }
        if (!includeSystem && fileInfo.isSystem) {
          continue;
        }

        files.push(fileInfo);

      } catch (err) {
        // Skip files we can't stat (permission issues, etc.)
        console.debug(`[WINDOWS_FS] Could not stat file: ${fullPath}`, err.message);
      }
    }

    return {
      files,
      error: null
    };

  } catch (error) {
    return {
      files: [],
      error: error.message
    };
  }
}

/**
 * Safely creates a directory handling long paths on Windows
 * @param {string} dirPath - Directory path to create
 * @param {Object} options - Options for directory creation
 * @param {boolean} options.recursive - Create parent directories (default: true)
 * @returns {Promise<Object>} Creation result
 * 
 * @example
 * const result = await createDirectorySafe('C:\\very\\long\\path\\...');
 * // { success: true, path: '...', error: null }
 */
export async function createDirectorySafe(dirPath, options = {}) {
  const { recursive = true } = options;

  if (!dirPath || typeof dirPath !== 'string') {
    return {
      success: false,
      path: null,
      error: 'Invalid directory path'
    };
  }

  try {
    // Handle long paths on Windows
    const pathResult = handleLongPath(dirPath);
    const targetPath = pathResult.path;

    // Check if directory already exists
    if (fs.existsSync(targetPath)) {
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        return {
          success: true,
          path: dirPath,
          error: null,
          alreadyExists: true
        };
      } else {
        return {
          success: false,
          path: null,
          error: 'Path exists but is not a directory'
        };
      }
    }

    // Create directory
    fs.mkdirSync(targetPath, { recursive });

    return {
      success: true,
      path: dirPath,
      error: null,
      alreadyExists: false
    };

  } catch (error) {
    // Provide helpful error messages
    let errorMessage = error.message;
    
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      errorMessage = 'Permission denied';
    } else if (error.code === 'EEXIST') {
      errorMessage = 'Path already exists';
    } else if (error.code === 'ENOENT') {
      errorMessage = 'Parent directory does not exist';
    } else if (error.code === 'ENOTDIR') {
      errorMessage = 'Parent path is not a directory';
    }

    return {
      success: false,
      path: null,
      error: errorMessage,
      code: error.code
    };
  }
}

/**
 * Checks if a path exceeds Windows MAX_PATH limit
 * @param {string} inputPath - Path to check
 * @returns {Object} Result with length information
 * 
 * @example
 * const result = checkPathLength('C:\\very\\long\\path\\...');
 * // { length: 275, exceedsMaxPath: true, maxPath: 260 }
 */
export function checkPathLength(inputPath) {
  if (!inputPath || typeof inputPath !== 'string') {
    return {
      length: 0,
      exceedsMaxPath: false,
      maxPath: MAX_PATH,
      error: 'Invalid input path'
    };
  }

  try {
    const absolutePath = path.resolve(inputPath);
    const length = absolutePath.length;
    const exceedsMaxPath = length >= MAX_PATH;

    return {
      length,
      exceedsMaxPath,
      maxPath: MAX_PATH,
      error: null
    };

  } catch (error) {
    return {
      length: 0,
      exceedsMaxPath: false,
      maxPath: MAX_PATH,
      error: error.message
    };
  }
}

/**
 * Gets comprehensive file information including Windows-specific attributes
 * @param {string} filePath - Path to get information for
 * @returns {Promise<Object>} File information
 * 
 * @example
 * const info = await getFileInfo('C:\\Users\\test\\file.txt');
 * // { exists: true, isHidden: false, isSystem: false, ... }
 */
export async function getFileInfo(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return {
      exists: false,
      error: 'Invalid file path'
    };
  }

  try {
    if (!fs.existsSync(filePath)) {
      return {
        exists: false,
        error: 'File does not exist'
      };
    }

    const stats = fs.statSync(filePath);
    const lstat = fs.lstatSync(filePath);

    const info = {
      exists: true,
      path: filePath,
      isDirectory: stats.isDirectory(),
      isFile: stats.isFile(),
      isSymbolicLink: lstat.isSymbolicLink(),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isHidden: false,
      isSystem: false,
      error: null
    };

    // Detect hidden files
    const basename = path.basename(filePath);
    if (basename.startsWith('.')) {
      info.isHidden = true;
    }

    // Detect system files (basic heuristic)
    if (isWindows) {
      const systemFolders = new Set([
        '$Recycle.Bin', 'System Volume Information',
        'Recovery', 'ProgramData', 'Windows'
      ]);
      
      if (systemFolders.has(basename)) {
        info.isSystem = true;
      }
    }

    // Get permissions
    const permissions = await checkWindowsPermissions(filePath);
    info.permissions = permissions;

    // Check if it's a symlink and resolve it
    if (info.isSymbolicLink) {
      const symlinkInfo = await resolveSymlink(filePath);
      info.symlinkTarget = symlinkInfo.targetPath;
      info.isJunction = symlinkInfo.isJunction;
    }

    return info;

  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

