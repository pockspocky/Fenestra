import fs from 'node:fs';
import path from 'node:path';
import '../../../logger.js';

/**
 * Resolve asset path with backward compatibility
 * Tries new path first, falls back to old path if needed
 * @param {string} assetPath - The asset path to resolve
 * @returns {string} Resolved asset path
 */
export function resolveAssetPath(assetPath) {
  if (!assetPath || typeof assetPath !== 'string') {
    console.warn('[ASSET_RESOLVER] Invalid asset path provided:', assetPath);
    return assetPath;
  }
  
  // If path already starts with renderer/assets/, use it as-is
  if (assetPath.startsWith('renderer/assets/')) {
    const fullPath = path.join(process.cwd(), assetPath);
    if (fs.existsSync(fullPath)) {
      console.debug(`[ASSET_RESOLVER] Using new path: ${assetPath}`);
      return assetPath;
    }
  }
  
  // Check if it's an old-style path that needs migration
  if (assetPath.startsWith('doors/')) {
    // Map old paths to new paths
    const pathMappings = {
      'doors/Door.png': 'renderer/assets/doors/DoorClosed.png',
      'doors/DoorClosed.png': 'renderer/assets/doors/DoorClosed.png',
      'doors/DoorOpened.png': 'renderer/assets/doors/DoorOpened.png',
      'doors/Keychain.jpeg': 'renderer/assets/doors/Keychain.jpeg'
    };
    
    const newPath = pathMappings[assetPath];
    if (newPath) {
      const fullNewPath = path.join(process.cwd(), newPath);
      if (fs.existsSync(fullNewPath)) {
        console.warn(`[ASSET_RESOLVER] Deprecated path used: "${assetPath}" -> "${newPath}". Please update to use new path.`);
        return newPath;
      }
      
      // If new path doesn't exist, try old path
      const fullOldPath = path.join(process.cwd(), assetPath);
      if (fs.existsSync(fullOldPath)) {
        console.warn(`[ASSET_RESOLVER] Using deprecated path: "${assetPath}". Please migrate to: "${newPath}"`);
        return assetPath;
      }
    }
  }
  
  // For any other path, return as-is
  return assetPath;
}

/**
 * Resolve door image path
 * @param {string} imagePath - Door image path
 * @param {string} state - Door state ('open' or 'closed')
 * @returns {string} Resolved door image path
 */
export function resolveDoorImagePath(imagePath, state = 'closed') {
  if (!imagePath) {
    // Return default based on state
    return state === 'open' 
      ? 'renderer/assets/doors/DoorOpened.png'
      : 'renderer/assets/doors/DoorClosed.png';
  }
  
  return resolveAssetPath(imagePath);
}

/**
 * Resolve key image path with new default and fallback logic
 * 
 * This function determines which key image to use based on the following priority:
 * 1. Custom image path (if provided and valid)
 * 2. Default key image (Key.png)
 * 3. Fallback to legacy image (Keychain.jpeg) if default doesn't exist
 * 
 * @param {string|null|undefined} imagePath - Optional custom key image path. 
 *   Can be relative (resolved from project root) or absolute path.
 *   If null, undefined, or empty string, uses default Key.png.
 * @returns {string} Resolved key image path (relative to project root for relative paths, 
 *   or absolute path for absolute paths)
 * @throws {never} Does not throw - returns a path even if files don't exist, 
 *   allowing renderer to handle missing images
 * 
 * @since 1.2.0 - Changed default from Keychain.jpeg to Key.png with fallback
 * @since 1.3.0 - Enhanced validation for relative and absolute paths
 * 
 * @example
 * // Use default key image
 * const defaultPath = resolveKeyImagePath(null);
 * // Returns: 'renderer/assets/Keys/Key.png'
 * 
 * @example
 * // Use custom relative path
 * const customPath = resolveKeyImagePath('renderer/assets/Keys/GoldKey.png');
 * // Returns: 'renderer/assets/Keys/GoldKey.png' (if exists)
 * 
 * @example
 * // Use custom absolute path
 * const absolutePath = resolveKeyImagePath('/Users/dev/custom-key.png');
 * // Returns: '/Users/dev/custom-key.png' (if exists)
 */
export function resolveKeyImagePath(imagePath) {
  if (!imagePath) {
    // Default key image path - new standard location
    const defaultPath = 'renderer/assets/Keys/Key.png';
    const fullDefaultPath = path.join(process.cwd(), defaultPath);
    
    // Verify the new default exists, fallback to legacy image if not
    if (fs.existsSync(fullDefaultPath)) {
      console.debug('[ASSET_RESOLVER] Using new default key image: Key.png');
      return defaultPath;
    } else {
      // Fallback to legacy key image for backward compatibility
      const fallbackPath = 'renderer/assets/doors/Keychain.jpeg';
      const fullFallbackPath = path.join(process.cwd(), fallbackPath);
      
      // Check if fallback exists
      if (fs.existsSync(fullFallbackPath)) {
        console.warn('[ASSET_RESOLVER] New default key image not found, falling back to Keychain.jpeg');
        return fallbackPath;
      } else {
        // Both default and fallback are missing - critical error
        // Return default path anyway and let renderer display broken image placeholder
        console.error('[ASSET_RESOLVER] CRITICAL: Neither default key image (Key.png) nor fallback (Keychain.jpeg) found! Returning default path anyway.');
        return defaultPath;
      }
    }
  }
  
  // Validate custom image path type
  if (typeof imagePath !== 'string') {
    console.warn(`[ASSET_RESOLVER] Invalid custom key image path type: ${typeof imagePath}, using default`);
    return resolveKeyImagePath(null); // Recursive call to get default
  }
  
  // Handle empty string as request for default
  if (imagePath.trim() === '') {
    console.debug('[ASSET_RESOLVER] Empty custom key image path provided, using default');
    return resolveKeyImagePath(null); // Recursive call to get default
  }
  
  let fullResolvedPath;
  let resolvedPath;
  
  try {
    // Check if path is absolute
    if (path.isAbsolute(imagePath)) {
      // Absolute path - use directly after validation
      fullResolvedPath = path.normalize(imagePath);
      resolvedPath = imagePath;
      
      // Validate absolute path exists
      if (!fs.existsSync(fullResolvedPath)) {
        console.warn(`[ASSET_RESOLVER] Custom key image not found at absolute path: ${imagePath}, using default`);
        return resolveKeyImagePath(null); // Fallback to default via recursive call
      }
      
      console.debug(`[ASSET_RESOLVER] Using custom key image from absolute path: ${resolvedPath}`);
      return resolvedPath;
    } else {
      // Relative path - resolve through asset resolver for backward compatibility
      resolvedPath = resolveAssetPath(imagePath);
      fullResolvedPath = path.join(process.cwd(), resolvedPath);
      
      // Validate relative path exists
      if (!fs.existsSync(fullResolvedPath)) {
        console.warn(`[ASSET_RESOLVER] Custom key image not found at relative path: ${imagePath} (resolved to: ${resolvedPath}), using default`);
        return resolveKeyImagePath(null); // Fallback to default via recursive call
      }
      
      console.debug(`[ASSET_RESOLVER] Using custom key image from relative path: ${resolvedPath}`);
      return resolvedPath;
    }
  } catch (error) {
    // Handle any path resolution errors gracefully
    console.warn(`[ASSET_RESOLVER] Error validating custom key image path: ${imagePath}, error: ${error.message}, using default`);
    return resolveKeyImagePath(null); // Fallback to default via recursive call
  }
}

/**
 * Check if asset exists
 * @param {string} assetPath - Asset path to check
 * @returns {boolean} True if asset exists
 */
export function assetExists(assetPath) {
  if (!assetPath) {
    return false;
  }
  
  const resolvedPath = resolveAssetPath(assetPath);
  const fullPath = path.join(process.cwd(), resolvedPath);
  return fs.existsSync(fullPath);
}
