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
 * Resolve key image path
 * @param {string} imagePath - Key image path
 * @returns {string} Resolved key image path
 */
export function resolveKeyImagePath(imagePath) {
  if (!imagePath) {
    return 'renderer/assets/doors/Keychain.jpeg';
  }
  
  return resolveAssetPath(imagePath);
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
