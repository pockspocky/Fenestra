/**
 * File Migrator
 * 
 * Implements file move operations with validation, creates target directories,
 * verifies file integrity, and implements rollback on failure.
 * 
 * @module FileMigrator
 */

import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

/**
 * File Migrator
 * Handles safe file migration with validation and rollback
 */
export class FileMigrator {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.dryRun = options.dryRun !== false;
    this.backupDir = options.backupDir || '.migration-backup';
    this.migrationLog = [];
  }

  /**
   * Calculate file hash for integrity verification
   * @param {string} filePath - Path to file
   * @returns {Promise<string>} File hash
   */
  async calculateFileHash(filePath) {
    try {
      const content = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate hash for ${filePath}: ${error.message}`);
    }
  }

  /**
   * Verify file exists and is readable
   * @param {string} filePath - Path to file
   * @returns {Promise<boolean>} True if file exists and is readable
   */
  async verifyFileExists(filePath) {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create directory if it doesn't exist
   * @param {string} dirPath - Directory path
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      this.log('create_dir', { path: dirPath });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }

  /**
   * Backup file before migration
   * @param {string} sourcePath - Source file path
   * @returns {Promise<string>} Backup file path
   */
  async backupFile(sourcePath) {
    const backupPath = path.join(this.rootDir, this.backupDir, sourcePath);
    const backupDir = path.dirname(backupPath);
    
    await this.ensureDirectory(backupDir);
    await fs.copyFile(
      path.join(this.rootDir, sourcePath),
      backupPath
    );
    
    this.log('backup', { source: sourcePath, backup: backupPath });
    return backupPath;
  }

  /**
   * Move single file with validation
   * @param {Object} mapping - File mapping {source, target}
   * @returns {Promise<Object>} Migration result
   */
  async moveFile(mapping) {
    const { source, target } = mapping;
    const sourcePath = path.join(this.rootDir, source);
    const targetPath = path.join(this.rootDir, target);

    // Verify source exists
    if (!(await this.verifyFileExists(sourcePath))) {
      throw new Error(`Source file does not exist: ${source}`);
    }

    // Calculate source hash
    const sourceHash = await this.calculateFileHash(sourcePath);

    if (this.dryRun) {
      this.log('dry_run_move', { source, target, hash: sourceHash });
      return {
        success: true,
        dryRun: true,
        source,
        target,
        hash: sourceHash
      };
    }

    // Backup source file
    const backupPath = await this.backupFile(source);

    // Ensure target directory exists
    const targetDir = path.dirname(targetPath);
    await this.ensureDirectory(targetDir);

    // Move file
    await fs.rename(sourcePath, targetPath);
    this.log('move', { source, target });

    // Verify target file integrity
    const targetHash = await this.calculateFileHash(targetPath);
    if (sourceHash !== targetHash) {
      throw new Error(`File integrity check failed for ${target}`);
    }

    this.log('verify', { target, hash: targetHash });

    return {
      success: true,
      source,
      target,
      hash: targetHash,
      backup: backupPath
    };
  }

  /**
   * Migrate multiple files
   * @param {Array} mappings - Array of file mappings
   * @returns {Promise<Object>} Migration results
   */
  async migrate(mappings) {
    const results = {
      successful: [],
      failed: [],
      skipped: []
    };

    console.log(`${this.dryRun ? '[DRY RUN] ' : ''}Starting migration of ${mappings.length} files...`);

    for (const mapping of mappings) {
      try {
        // Skip if source and target are the same
        if (mapping.source === mapping.target) {
          results.skipped.push({
            mapping,
            reason: 'Source and target are identical'
          });
          continue;
        }

        const result = await this.moveFile(mapping);
        results.successful.push(result);
        
        if (!this.dryRun) {
          console.log(`✓ Moved: ${mapping.source} → ${mapping.target}`);
        } else {
          console.log(`[DRY RUN] Would move: ${mapping.source} → ${mapping.target}`);
        }
      } catch (error) {
        results.failed.push({
          mapping,
          error: error.message
        });
        console.error(`✗ Failed: ${mapping.source} - ${error.message}`);
        
        // Stop on first failure if not dry run
        if (!this.dryRun) {
          console.error('Migration stopped due to error. Rolling back...');
          await this.rollback(results.successful);
          throw new Error(`Migration failed at ${mapping.source}: ${error.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Rollback migration
   * @param {Array} successfulMigrations - Array of successful migrations
   */
  async rollback(successfulMigrations) {
    console.log('Rolling back migration...');
    
    for (const migration of successfulMigrations.reverse()) {
      try {
        const sourcePath = path.join(this.rootDir, migration.source);
        const targetPath = path.join(this.rootDir, migration.target);
        
        // Move file back to original location
        await fs.rename(targetPath, sourcePath);
        console.log(`✓ Rolled back: ${migration.target} → ${migration.source}`);
      } catch (error) {
        console.error(`✗ Rollback failed for ${migration.target}: ${error.message}`);
      }
    }

    console.log('Rollback complete');
  }

  /**
   * Clean up empty directories
   * @param {Array} directories - Directories to check
   */
  async cleanupEmptyDirectories(directories) {
    for (const dir of directories) {
      try {
        const dirPath = path.join(this.rootDir, dir);
        const entries = await fs.readdir(dirPath);
        
        if (entries.length === 0) {
          await fs.rmdir(dirPath);
          console.log(`✓ Removed empty directory: ${dir}`);
        }
      } catch (error) {
        // Directory doesn't exist or can't be removed, skip
      }
    }
  }

  /**
   * Verify migration integrity
   * @param {Object} results - Migration results
   * @returns {Promise<Object>} Verification result
   */
  async verifyMigration(results) {
    const verification = {
      passed: true,
      checks: []
    };

    for (const migration of results.successful) {
      if (migration.dryRun) {
        continue;
      }

      const targetPath = path.join(this.rootDir, migration.target);
      
      // Check file exists
      const exists = await this.verifyFileExists(targetPath);
      if (!exists) {
        verification.passed = false;
        verification.checks.push({
          file: migration.target,
          check: 'exists',
          passed: false,
          message: 'File does not exist at target location'
        });
        continue;
      }

      // Check file hash
      const currentHash = await this.calculateFileHash(targetPath);
      const hashMatch = currentHash === migration.hash;
      
      verification.checks.push({
        file: migration.target,
        check: 'integrity',
        passed: hashMatch,
        message: hashMatch ? 'File integrity verified' : 'File hash mismatch'
      });

      if (!hashMatch) {
        verification.passed = false;
      }
    }

    return verification;
  }

  /**
   * Log migration action
   * @param {string} action - Action type
   * @param {Object} data - Action data
   */
  log(action, data) {
    this.migrationLog.push({
      timestamp: new Date().toISOString(),
      action,
      data
    });
  }

  /**
   * Export migration log
   * @param {string} outputPath - Output file path
   */
  async exportLog(outputPath) {
    await fs.writeFile(
      path.join(this.rootDir, outputPath),
      JSON.stringify(this.migrationLog, null, 2)
    );
    console.log(`Migration log exported to: ${outputPath}`);
  }

  /**
   * Get migration statistics
   * @param {Object} results - Migration results
   * @returns {Object} Statistics
   */
  getStatistics(results) {
    return {
      total: results.successful.length + results.failed.length + results.skipped.length,
      successful: results.successful.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      successRate: results.successful.length / 
        (results.successful.length + results.failed.length) * 100
    };
  }
}
