/**
 * Directory Structure Designer
 * 
 * Defines target directory structure and creates file mappings from current to target locations.
 * Validates mapping completeness to ensure all files are accounted for.
 * 
 * @module DirectoryStructureDesigner
 */

import path from 'path';
import fs from 'fs/promises';
import { glob } from 'glob';

/**
 * Directory Structure Designer
 * Analyzes current structure and creates mapping to target structure
 */
export class DirectoryStructureDesigner {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.dryRun = options.dryRun !== false;
    
    // Define target directory structure
    this.targetStructure = {
      'src/core': ['config.js', 'index.js', 'loggerConfig.js'],
      'src/systems': [
        'doorKeySystem.js',
        'emailSystem.js',
        'gameLogic.js',
        'gameStateManager.js',
        'lensSystem.js',
        'windowManager.js'
      ],
      'src/events': [
        'EventEmitter.js',
        'systemEvents.js',
        'domainEvents.js',
        'compatibilityLayer.js',
        'eventTracing.js'
      ],
      'src/handlers': [
        'ipcHandlers.js',
        'hotkeyManager.js',
        'startMenuManager.js'
      ],
      'src/security': [
        'auditSystem.js',
        'emailSandbox.js',
        'emailSchemaValidator.js',
        'ipcSecurityManager.js',
        'secureEmailActions.js',
        'pathSecurityValidator.js'
      ],
      'src/storage': [
        'emailStorage.js',
        'windowStorage.js',
        'emailActions.js'
      ],
      'src/utils': [
        'assetPathResolver.js',
        'dependencyResolver.js',
        'directoryNavigator.js',
        'errorHandler.js',
        'memoryIntegration.js',
        'memoryManager.js',
        'pathUtils.js',
        'windowsFileSystem.js'
      ],
      'src/workers': [
        'workerManager.js'
      ]
    };
    
    // Files to exclude from mapping (tools, old callback system, examples)
    this.excludedFiles = new Set([
      'callbackRegistry.js',
      'callbackFactory.js',
      'windowCallbacks.js',
      'doorKeyCallbacks.js',
      'emailCallbacks.js',
      'fileSystemCallbacks.js',
      'gameStateCallbacks.js',
      'ipcCallbacks.js',
      'lensCallbacks.js',
      'auditIntegrationExample.js'
    ]);
    
    // Directories to exclude from mapping (tools stay in place)
    this.excludedDirs = new Set([
      'src/tools'
    ]);
  }

  /**
   * Scan current directory structure
   * @returns {Promise<Object>} Current file structure
   */
  async scanCurrentStructure() {
    const files = await glob('src/**/*.js', {
      cwd: this.rootDir,
      ignore: ['**/node_modules/**', '**/test-output/**']
    });

    const structure = {};
    for (const file of files) {
      const dir = path.dirname(file);
      const basename = path.basename(file);
      
      if (!structure[dir]) {
        structure[dir] = [];
      }
      structure[dir].push(basename);
    }

    return structure;
  }

  /**
   * Create file mapping from current to target locations
   * @returns {Promise<Array>} Array of file mappings
   */
  async createFileMapping() {
    const currentStructure = await this.scanCurrentStructure();
    const mappings = [];
    const unmappedFiles = [];

    // Create mapping based on target structure
    for (const [targetDir, files] of Object.entries(this.targetStructure)) {
      for (const file of files) {
        // Skip excluded files
        if (this.excludedFiles.has(file)) {
          continue;
        }
        
        const found = this.findFileInCurrentStructure(file, currentStructure);
        
        if (found) {
          const sourcePath = path.join(found.dir, file);
          const targetPath = path.join(targetDir, file);
          
          // Only add mapping if source and target are different
          if (sourcePath !== targetPath) {
            mappings.push({
              source: sourcePath,
              target: targetPath,
              type: 'move',
              category: this.categorizeFile(targetDir)
            });
          }
        } else {
          unmappedFiles.push({ file, targetDir });
        }
      }
    }

    // Find files in current structure not in target structure
    const targetFiles = new Set();
    for (const files of Object.values(this.targetStructure)) {
      files.forEach(f => targetFiles.add(f));
    }

    for (const [dir, files] of Object.entries(currentStructure)) {
      // Skip excluded directories
      if (Array.from(this.excludedDirs).some(excludedDir => dir.startsWith(excludedDir))) {
        continue;
      }
      
      for (const file of files) {
        // Skip excluded files
        if (this.excludedFiles.has(file)) {
          continue;
        }
        
        if (!targetFiles.has(file)) {
          unmappedFiles.push({
            file,
            currentDir: dir,
            reason: 'Not in target structure (excluded or legacy)'
          });
        }
      }
    }

    return {
      mappings,
      unmappedFiles,
      stats: {
        totalMappings: mappings.length,
        unmappedCount: unmappedFiles.length
      }
    };
  }

  /**
   * Find file in current structure
   * @param {string} filename - File to find
   * @param {Object} structure - Current structure
   * @returns {Object|null} Found file location
   */
  findFileInCurrentStructure(filename, structure) {
    for (const [dir, files] of Object.entries(structure)) {
      if (files.includes(filename)) {
        return { dir, file: filename };
      }
    }
    return null;
  }

  /**
   * Categorize file based on target directory
   * @param {string} targetDir - Target directory
   * @returns {string} Category
   */
  categorizeFile(targetDir) {
    const dirName = path.basename(targetDir);
    const categories = {
      'core': 'Core Configuration',
      'systems': 'Game Systems',
      'events': 'Event System',
      'handlers': 'Event Handlers',
      'security': 'Security',
      'storage': 'Data Storage',
      'utils': 'Utilities',
      'workers': 'Worker Threads'
    };
    return categories[dirName] || 'Other';
  }

  /**
   * Validate mapping completeness
   * @param {Object} mapping - File mapping result
   * @returns {Object} Validation result
   */
  validateMapping(mapping) {
    const issues = [];
    const warnings = [];

    // Check for unmapped files
    if (mapping.unmappedFiles.length > 0) {
      warnings.push({
        type: 'unmapped_files',
        count: mapping.unmappedFiles.length,
        files: mapping.unmappedFiles,
        message: `${mapping.unmappedFiles.length} files are not mapped to target structure`
      });
    }

    // Check for duplicate targets
    const targetPaths = new Map();
    for (const m of mapping.mappings) {
      if (targetPaths.has(m.target)) {
        issues.push({
          type: 'duplicate_target',
          target: m.target,
          sources: [targetPaths.get(m.target), m.source],
          message: `Multiple files map to same target: ${m.target}`
        });
      }
      targetPaths.set(m.target, m.source);
    }

    // Check for circular mappings
    const sourceSet = new Set(mapping.mappings.map(m => m.source));
    const targetSet = new Set(mapping.mappings.map(m => m.target));
    const circular = [...sourceSet].filter(s => targetSet.has(s));
    
    if (circular.length > 0) {
      issues.push({
        type: 'circular_mapping',
        files: circular,
        message: `Files appear as both source and target: ${circular.join(', ')}`
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      summary: {
        totalMappings: mapping.mappings.length,
        unmappedFiles: mapping.unmappedFiles.length,
        issuesFound: issues.length,
        warningsFound: warnings.length
      }
    };
  }

  /**
   * Generate mapping report
   * @param {Object} mapping - File mapping
   * @param {Object} validation - Validation result
   * @returns {string} Report text
   */
  generateReport(mapping, validation) {
    const lines = [];
    
    lines.push('# Directory Structure Mapping Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');
    
    lines.push('## Summary');
    lines.push(`- Total Mappings: ${mapping.stats.totalMappings}`);
    lines.push(`- Unmapped Files: ${mapping.stats.unmappedCount}`);
    lines.push(`- Validation: ${validation.valid ? 'PASSED' : 'FAILED'}`);
    lines.push(`- Issues: ${validation.issues.length}`);
    lines.push(`- Warnings: ${validation.warnings.length}`);
    lines.push('');

    if (validation.issues.length > 0) {
      lines.push('## Issues');
      for (const issue of validation.issues) {
        lines.push(`- **${issue.type}**: ${issue.message}`);
      }
      lines.push('');
    }

    if (validation.warnings.length > 0) {
      lines.push('## Warnings');
      for (const warning of validation.warnings) {
        lines.push(`- **${warning.type}**: ${warning.message}`);
      }
      lines.push('');
    }

    lines.push('## File Mappings by Category');
    lines.push('');

    const byCategory = {};
    for (const m of mapping.mappings) {
      if (!byCategory[m.category]) {
        byCategory[m.category] = [];
      }
      byCategory[m.category].push(m);
    }

    for (const [category, mappings] of Object.entries(byCategory)) {
      lines.push(`### ${category} (${mappings.length} files)`);
      lines.push('');
      for (const m of mappings) {
        lines.push(`- \`${m.source}\` → \`${m.target}\``);
      }
      lines.push('');
    }

    if (mapping.unmappedFiles.length > 0) {
      lines.push('## Unmapped Files');
      lines.push('');
      for (const file of mapping.unmappedFiles) {
        if (file.currentDir) {
          lines.push(`- \`${path.join(file.currentDir, file.file)}\` - ${file.reason || 'Not in target structure'}`);
        } else {
          lines.push(`- \`${file.file}\` (target: \`${file.targetDir}\`) - Not found in current structure`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Design directory structure and create mapping
   * @returns {Promise<Object>} Complete design result
   */
  async design() {
    console.log('Scanning current directory structure...');
    const currentStructure = await this.scanCurrentStructure();
    
    console.log('Creating file mappings...');
    const mapping = await this.createFileMapping();
    
    console.log('Validating mappings...');
    const validation = this.validateMapping(mapping);
    
    console.log('Generating report...');
    const report = this.generateReport(mapping, validation);

    return {
      currentStructure,
      mapping,
      validation,
      report,
      targetStructure: this.targetStructure
    };
  }

  /**
   * Export design to file
   * @param {Object} design - Design result
   * @param {string} outputPath - Output file path
   */
  async exportDesign(design, outputPath) {
    const data = {
      timestamp: new Date().toISOString(),
      targetStructure: design.targetStructure,
      mappings: design.mapping.mappings,
      unmappedFiles: design.mapping.unmappedFiles,
      validation: design.validation
    };

    await fs.writeFile(
      path.join(this.rootDir, outputPath),
      JSON.stringify(data, null, 2)
    );

    console.log(`Design exported to: ${outputPath}`);
  }
}
