/**
 * HTML File Loader
 * Handles loading HTML files for email templates and resolving asset paths
 */

import fs from 'fs/promises';
import path from 'path';
import '../../logger.js';

/**
 * Resolves a bodyFile path to an absolute path
 * @param {string} bodyFile - Path from email JSON
 * @param {string} projectRoot - Project root directory
 * @param {string} templatesDir - Templates directory path
 * @returns {string} Absolute file path
 */
export function resolveHtmlFilePath(bodyFile, projectRoot, templatesDir) {
  if (!bodyFile || typeof bodyFile !== 'string') {
    throw new Error('bodyFile must be a non-empty string');
  }

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = bodyFile.replace(/\\/g, '/');

  // Check if path is absolute (starts with / or drive letter like C:)
  const isAbsolute = normalizedPath.startsWith('/') || /^[A-Za-z]:/.test(normalizedPath);

  let resolvedPath;
  if (isAbsolute) {
    // Absolute path - resolve relative to project root
    // Remove leading slash for path.join to work correctly
    const pathWithoutLeadingSlash = normalizedPath.startsWith('/') 
      ? normalizedPath.substring(1) 
      : normalizedPath;
    resolvedPath = path.join(projectRoot, pathWithoutLeadingSlash);
  } else {
    // Relative path - resolve relative to templates directory
    resolvedPath = path.join(templatesDir, normalizedPath);
  }

  // Normalize the resolved path (handles .., ., etc.)
  resolvedPath = path.resolve(resolvedPath);

  // Verify the resolved path is within project root
  const normalizedProjectRoot = path.resolve(projectRoot);
  if (!resolvedPath.startsWith(normalizedProjectRoot)) {
    throw new Error(`Path outside project root: ${bodyFile}`);
  }

  return resolvedPath;
}

/**
 * Ensures templates directory exists
 * @param {string} templatesDir - Templates directory path
 * @returns {Promise<Object>} Result with success flag
 */
export async function ensureTemplatesDirectory(templatesDir) {
  try {
    await fs.mkdir(templatesDir, { recursive: true });
    console.log(`[htmlFileLoader] Templates directory ensured: ${templatesDir}`);
    return { success: true };
  } catch (error) {
    console.error(`[htmlFileLoader] Failed to create templates directory: ${error.message}`);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Rewrites relative asset paths in HTML to be relative to project root
 * @param {string} htmlContent - HTML content
 * @param {string} htmlFileDir - Directory containing the HTML file
 * @param {string} projectRoot - Project root directory
 * @returns {string} HTML with rewritten paths
 */
export function rewriteAssetPaths(htmlContent, htmlFileDir, projectRoot) {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return htmlContent;
  }

  // Patterns to match asset references
  // Matches: src="...", href="...", but not URLs (http://, https://, //, etc.)
  const patterns = [
    { regex: /(<img[^>]+src=["'])([^"']+)(["'])/gi, group: 2 },
    { regex: /(<link[^>]+href=["'])([^"']+)(["'])/gi, group: 2 },
    { regex: /(<script[^>]+src=["'])([^"']+)(["'])/gi, group: 2 },
    { regex: /(<a[^>]+href=["'])([^"']+)(["'])/gi, group: 2 }
  ];

  let rewrittenHtml = htmlContent;

  patterns.forEach(({ regex }) => {
    rewrittenHtml = rewrittenHtml.replace(regex, (match, prefix, assetPath, suffix) => {
      // Skip if it's an absolute URL or absolute path
      if (
        assetPath.startsWith('http://') ||
        assetPath.startsWith('https://') ||
        assetPath.startsWith('//') ||
        assetPath.startsWith('/') ||
        /^[A-Za-z]:/.test(assetPath) ||
        assetPath.startsWith('#') ||
        assetPath.startsWith('data:') ||
        assetPath.startsWith('javascript:')
      ) {
        return match; // Keep as-is
      }

      // Resolve relative path to absolute path
      const absoluteAssetPath = path.resolve(htmlFileDir, assetPath);
      
      // Convert to path relative to project root
      const relativeToRoot = path.relative(projectRoot, absoluteAssetPath);
      
      // Normalize path separators to forward slashes for web compatibility
      const normalizedPath = relativeToRoot.replace(/\\/g, '/');

      return `${prefix}${normalizedPath}${suffix}`;
    });
  });

  return rewrittenHtml;
}

/**
 * Loads HTML content from a file and resolves asset paths
 * @param {string} bodyFile - Path to HTML file (relative or absolute)
 * @param {string} projectRoot - Project root directory
 * @param {string} templatesDir - Templates directory path
 * @returns {Promise<Object>} Result with HTML content or error
 */
export async function loadHtmlFile(bodyFile, projectRoot, templatesDir) {
  try {
    // Resolve the file path
    const resolvedPath = resolveHtmlFilePath(bodyFile, projectRoot, templatesDir);
    
    console.log(`[htmlFileLoader] Loading HTML file: ${resolvedPath}`);

    // Check if file exists
    try {
      await fs.access(resolvedPath);
    } catch (error) {
      return {
        success: false,
        error: 'File not found',
        userMessage: `HTML template file not found: ${bodyFile}`
      };
    }

    // Read file content
    let htmlContent;
    try {
      htmlContent = await fs.readFile(resolvedPath, 'utf-8');
    } catch (error) {
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        return {
          success: false,
          error: 'Permission denied',
          userMessage: `Cannot read HTML template file (permission denied): ${bodyFile}`
        };
      }
      throw error; // Re-throw unexpected errors
    }

    // Rewrite asset paths
    const htmlFileDir = path.dirname(resolvedPath);
    const rewrittenHtml = rewriteAssetPaths(htmlContent, htmlFileDir, projectRoot);

    console.log(`[htmlFileLoader] Successfully loaded HTML file: ${bodyFile}`);

    return {
      success: true,
      content: rewrittenHtml,
      filePath: resolvedPath
    };
  } catch (error) {
    console.error(`[htmlFileLoader] Error loading HTML file: ${error.message}`);
    
    // Check if it's a path validation error
    if (error.message.includes('outside project root')) {
      return {
        success: false,
        error: error.message,
        userMessage: `HTML template file is outside project directory: ${bodyFile}`
      };
    }

    return {
      success: false,
      error: error.message,
      userMessage: `Failed to load HTML template: ${error.message}`
    };
  }
}
