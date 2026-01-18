/**
 * Import Updater
 * 
 * Parses JavaScript files to extract import statements, updates import paths
 * based on file mappings, validates all imports resolve correctly, and handles
 * both relative and absolute import paths.
 * 
 * @module ImportUpdater
 */

import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';

/**
 * Import Updater
 * Updates import statements after file migration
 */
export class ImportUpdater {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.dryRun = options.dryRun !== false;
    this.updateLog = [];
  }

  /**
   * Extract import statements from JavaScript file
   * @param {string} content - File content
   * @returns {Array} Array of import statements
   */
  extractImports(content) {
    const imports = [];
    
    // Match ES6 import statements
    const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({
        fullMatch: match[0],
        path: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }

    // Match dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      imports.push({
        fullMatch: match[0],
        path: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        dynamic: true
      });
    }

    // Match require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({
        fullMatch: match[0],
        path: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        require: true
      });
    }

    return imports;
  }

  /**
   * Calculate new import path based on file mappings
   * @param {string} currentFilePath - Current file path
   * @param {string} importPath - Import path to update
   * @param {Map} fileMapping - Map of old paths to new paths
   * @returns {string|null} New import path or null if no update needed
   */
  calculateNewImportPath(currentFilePath, importPath, fileMapping) {
    // Skip non-relative imports (node modules, etc.)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    // Resolve the absolute path of the imported file
    const currentDir = path.dirname(currentFilePath);
    const resolvedImport = path.resolve(currentDir, importPath);
    
    // Normalize to relative path from root
    const relativeImport = path.relative(this.rootDir, resolvedImport);
    
    // Check if this file was moved
    const newLocation = fileMapping.get(relativeImport) || 
                       fileMapping.get(relativeImport + '.js');

    if (!newLocation) {
      return null;
    }

    // Calculate new relative path from current file to new location
    const newCurrentDir = path.dirname(currentFilePath);
    const newRelativePath = path.relative(
      newCurrentDir,
      path.join(this.rootDir, newLocation)
    );

    // Ensure path starts with ./ or ../
    const normalizedPath = newRelativePath.startsWith('.') 
      ? newRelativePath 
      : './' + newRelativePath;

    // Convert Windows paths to Unix-style for imports
    return normalizedPath.replace(/\\/g, '/');
  }

  /**
   * Update imports in a single file
   * @param {string} filePath - File path
   * @param {Map} fileMapping - Map of old paths to new paths
   * @returns {Promise<Object>} Update result
   */
  async updateFileImports(filePath, fileMapping) {
    const fullPath = path.join(this.rootDir, filePath);
    
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const imports = this.extractImports(content);
      
      if (imports.length === 0) {
        return {
          file: filePath,
          updated: false,
          changes: 0
        };
      }

      let updatedContent = content;
      const changes = [];
      let offset = 0;

      for (const imp of imports) {
        const newPath = this.calculateNewImportPath(filePath, imp.path, fileMapping);
        
        if (newPath && newPath !== imp.path) {
          // Replace the import path in the full match
          const newImport = imp.fullMatch.replace(
            new RegExp(`['"]${imp.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`),
            `'${newPath}'`
          );

          // Update content with offset adjustment
          const startIdx = imp.startIndex + offset;
          const endIdx = imp.endIndex + offset;
          
          updatedContent = 
            updatedContent.substring(0, startIdx) +
            newImport +
            updatedContent.substring(endIdx);

          offset += newImport.length - imp.fullMatch.length;

          changes.push({
            oldPath: imp.path,
            newPath,
            line: content.substring(0, imp.startIndex).split('\n').length
          });
        }
      }

      if (changes.length > 0) {
        if (!this.dryRun) {
          await fs.writeFile(fullPath, updatedContent, 'utf-8');
        }

        this.log('update_imports', {
          file: filePath,
          changes
        });

        return {
          file: filePath,
          updated: true,
          changes: changes.length,
          details: changes
        };
      }

      return {
        file: filePath,
        updated: false,
        changes: 0
      };
    } catch (error) {
      throw new Error(`Failed to update imports in ${filePath}: ${error.message}`);
    }
  }

  /**
   * Update imports in all files
   * @param {Array} mappings - File mappings
   * @returns {Promise<Object>} Update results
   */
  async updateAllImports(mappings) {
    // Create mapping lookup
    const fileMapping = new Map();
    for (const mapping of mappings) {
      fileMapping.set(mapping.source, mapping.target);
    }

    // Get all JavaScript files
    const files = await glob('src/**/*.js', {
      cwd: this.rootDir,
      ignore: ['**/node_modules/**', '**/test-output/**']
    });

    const results = {
      successful: [],
      failed: [],
      unchanged: []
    };

    console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Updating imports in ${files.length} files...`);

    for (const file of files) {
      try {
        // Check if this file was moved, use new location
        const currentPath = fileMapping.get(file) || file;
        const result = await this.updateFileImports(currentPath, fileMapping);

        if (result.updated) {
          results.successful.push(result);
          if (!this.dryRun) {
            console.log(`✓ Updated ${result.changes} imports in: ${result.file}`);
          } else {
            console.log(`[DRY RUN] Would update ${result.changes} imports in: ${result.file}`);
          }
        } else {
          results.unchanged.push(result);
        }
      } catch (error) {
        results.failed.push({
          file,
          error: error.message
        });
        console.error(`✗ Failed to update ${file}: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Validate all imports resolve correctly
   * @returns {Promise<Object>} Validation result
   */
  async validateImports() {
    const files = await glob('src/**/*.js', {
      cwd: this.rootDir,
      ignore: ['**/node_modules/**', '**/test-output/**']
    });

    const validation = {
      passed: true,
      issues: []
    };

    console.log(`Validating imports in ${files.length} files...`);

    for (const file of files) {
      const fullPath = path.join(this.rootDir, file);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const imports = this.extractImports(content);

        for (const imp of imports) {
          // Skip non-relative imports
          if (!imp.path.startsWith('.') && !imp.path.startsWith('/')) {
            continue;
          }

          // Resolve import path
          const currentDir = path.dirname(fullPath);
          let resolvedPath = path.resolve(currentDir, imp.path);

          // Try with .js extension if not present
          let exists = false;
          try {
            await fs.access(resolvedPath);
            exists = true;
          } catch {
            // Try with .js extension
            if (!resolvedPath.endsWith('.js')) {
              try {
                await fs.access(resolvedPath + '.js');
                exists = true;
              } catch {
                exists = false;
              }
            }
          }

          if (!exists) {
            validation.passed = false;
            validation.issues.push({
              file,
              import: imp.path,
              line: content.substring(0, imp.startIndex).split('\n').length,
              message: `Import cannot be resolved: ${imp.path}`
            });
          }
        }
      } catch (error) {
        validation.passed = false;
        validation.issues.push({
          file,
          error: error.message,
          message: `Failed to validate file: ${error.message}`
        });
      }
    }

    return validation;
  }

  /**
   * Log update action
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  log(action, data) {
    this.updateLog.push({
      timestamp: new Date().toISOString(),
      action,
      data
    });
  }

  /**
   * Export update log
   * @param {string} outputPath - Output file path
   */
  async exportLog(outputPath) {
    await fs.writeFile(
      path.join(this.rootDir, outputPath),
      JSON.stringify(this.updateLog, null, 2)
    );
    console.log(`Import update log exported to: ${outputPath}`);
  }

  /**
   * Get update statistics
   * @param {Object} results - Update results
   * @returns {Object} Statistics
   */
  getStatistics(results) {
    const totalChanges = results.successful.reduce(
      (sum, r) => sum + r.changes, 
      0
    );

    return {
      totalFiles: results.successful.length + results.failed.length + results.unchanged.length,
      filesUpdated: results.successful.length,
      filesUnchanged: results.unchanged.length,
      filesFailed: results.failed.length,
      totalImportChanges: totalChanges
    };
  }
}
