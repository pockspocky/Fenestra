#!/usr/bin/env node

/**
 * Directory Restructurer CLI
 * 
 * Command-line interface for directory restructuring operations:
 * - design: Create directory structure design and file mappings
 * - migrate: Execute file migration
 * - update-imports: Update import statements
 * - validate: Validate import resolution
 * - execute: Run complete restructuring workflow
 * 
 * @module cli
 */

import { Command } from 'commander';
import path from 'path';
import fs from 'fs/promises';
import { DirectoryStructureDesigner } from './DirectoryStructureDesigner.js';
import { FileMigrator } from './FileMigrator.js';
import { ImportUpdater } from './ImportUpdater.js';

const program = new Command();

program
  .name('directory-restructurer')
  .description('Directory restructuring tool for Fenestra codebase')
  .version('1.0.0');

/**
 * Design command - Create directory structure design
 */
program
  .command('design')
  .description('Create directory structure design and file mappings')
  .option('-o, --output <path>', 'Output file path', 'directory-structure-design.json')
  .option('-r, --report <path>', 'Report file path', 'directory-structure-report.md')
  .action(async (options) => {
    try {
      console.log('Creating directory structure design...\n');
      
      const designer = new DirectoryStructureDesigner({
        rootDir: process.cwd()
      });

      const design = await designer.design();

      // Export design
      await designer.exportDesign(design, options.output);

      // Write report
      await fs.writeFile(
        path.join(process.cwd(), options.report),
        design.report
      );

      console.log(`\nReport written to: ${options.report}`);
      console.log('\nDesign Summary:');
      console.log(`- Total Mappings: ${design.mapping.stats.totalMappings}`);
      console.log(`- Unmapped Files: ${design.mapping.stats.unmappedCount}`);
      console.log(`- Validation: ${design.validation.valid ? 'PASSED' : 'FAILED'}`);
      console.log(`- Issues: ${design.validation.issues.length}`);
      console.log(`- Warnings: ${design.validation.warnings.length}`);

      if (!design.validation.valid) {
        console.error('\n⚠️  Validation failed. Please review the report.');
        process.exit(1);
      }

      console.log('\n✓ Design complete');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Migrate command - Execute file migration
 */
program
  .command('migrate')
  .description('Execute file migration based on design')
  .option('-i, --input <path>', 'Design file path', 'directory-structure-design.json')
  .option('--dry-run', 'Perform dry run without actual changes', true)
  .option('--execute', 'Execute actual migration (disables dry-run)')
  .option('-l, --log <path>', 'Migration log path', 'migration-log.json')
  .action(async (options) => {
    try {
      const dryRun = !options.execute;
      
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Starting file migration...\n`);

      // Load design
      const designPath = path.join(process.cwd(), options.input);
      const designData = JSON.parse(await fs.readFile(designPath, 'utf-8'));

      const migrator = new FileMigrator({
        rootDir: process.cwd(),
        dryRun
      });

      // Execute migration
      const results = await migrator.migrate(designData.mappings);

      // Export log
      await migrator.exportLog(options.log);

      // Display statistics
      const stats = migrator.getStatistics(results);
      console.log('\nMigration Statistics:');
      console.log(`- Total Files: ${stats.total}`);
      console.log(`- Successful: ${stats.successful}`);
      console.log(`- Failed: ${stats.failed}`);
      console.log(`- Skipped: ${stats.skipped}`);
      console.log(`- Success Rate: ${stats.successRate.toFixed(2)}%`);

      if (!dryRun && results.successful.length > 0) {
        // Verify migration
        console.log('\nVerifying migration integrity...');
        const verification = await migrator.verifyMigration(results);
        
        if (verification.passed) {
          console.log('✓ Migration integrity verified');
        } else {
          console.error('✗ Migration integrity check failed');
          console.error('Failed checks:', verification.checks.filter(c => !c.passed));
          process.exit(1);
        }
      }

      if (dryRun) {
        console.log('\n✓ Dry run complete. Use --execute to perform actual migration.');
      } else {
        console.log('\n✓ Migration complete');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Update imports command - Update import statements
 */
program
  .command('update-imports')
  .description('Update import statements after migration')
  .option('-i, --input <path>', 'Design file path', 'directory-structure-design.json')
  .option('--dry-run', 'Perform dry run without actual changes', true)
  .option('--execute', 'Execute actual updates (disables dry-run)')
  .option('-l, --log <path>', 'Update log path', 'import-update-log.json')
  .action(async (options) => {
    try {
      const dryRun = !options.execute;
      
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Updating import statements...\n`);

      // Load design
      const designPath = path.join(process.cwd(), options.input);
      const designData = JSON.parse(await fs.readFile(designPath, 'utf-8'));

      const updater = new ImportUpdater({
        rootDir: process.cwd(),
        dryRun
      });

      // Update imports
      const results = await updater.updateAllImports(designData.mappings);

      // Export log
      await updater.exportLog(options.log);

      // Display statistics
      const stats = updater.getStatistics(results);
      console.log('\nImport Update Statistics:');
      console.log(`- Total Files: ${stats.totalFiles}`);
      console.log(`- Files Updated: ${stats.filesUpdated}`);
      console.log(`- Files Unchanged: ${stats.filesUnchanged}`);
      console.log(`- Files Failed: ${stats.filesFailed}`);
      console.log(`- Total Import Changes: ${stats.totalImportChanges}`);

      if (dryRun) {
        console.log('\n✓ Dry run complete. Use --execute to perform actual updates.');
      } else {
        console.log('\n✓ Import updates complete');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Validate command - Validate import resolution
 */
program
  .command('validate')
  .description('Validate all imports resolve correctly')
  .action(async () => {
    try {
      console.log('Validating import resolution...\n');

      const updater = new ImportUpdater({
        rootDir: process.cwd()
      });

      const validation = await updater.validateImports();

      if (validation.passed) {
        console.log('✓ All imports resolve correctly');
      } else {
        console.error(`✗ Found ${validation.issues.length} import resolution issues:\n`);
        
        for (const issue of validation.issues) {
          console.error(`  ${issue.file}:${issue.line || '?'}`);
          console.error(`    ${issue.message}`);
          if (issue.import) {
            console.error(`    Import: ${issue.import}`);
          }
          console.error('');
        }

        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Execute command - Run complete restructuring workflow
 */
program
  .command('execute')
  .description('Execute complete directory restructuring workflow')
  .option('--dry-run', 'Perform dry run without actual changes', true)
  .option('--execute', 'Execute actual restructuring (disables dry-run)')
  .action(async (options) => {
    try {
      const dryRun = !options.execute;
      
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Starting complete directory restructuring...\n`);

      // Step 1: Design
      console.log('Step 1: Creating directory structure design...');
      const designer = new DirectoryStructureDesigner({
        rootDir: process.cwd()
      });
      const design = await designer.design();
      await designer.exportDesign(design, 'directory-structure-design.json');
      
      if (!design.validation.valid) {
        console.error('✗ Design validation failed. Aborting.');
        process.exit(1);
      }
      console.log('✓ Design complete\n');

      // Step 2: Migrate files
      console.log('Step 2: Migrating files...');
      const migrator = new FileMigrator({
        rootDir: process.cwd(),
        dryRun
      });
      const migrationResults = await migrator.migrate(design.mapping.mappings);
      await migrator.exportLog('migration-log.json');
      
      if (migrationResults.failed.length > 0) {
        console.error('✗ Migration failed. Aborting.');
        process.exit(1);
      }
      console.log('✓ Migration complete\n');

      // Step 3: Update imports
      console.log('Step 3: Updating import statements...');
      const updater = new ImportUpdater({
        rootDir: process.cwd(),
        dryRun
      });
      const updateResults = await updater.updateAllImports(design.mapping.mappings);
      await updater.exportLog('import-update-log.json');
      console.log('✓ Import updates complete\n');

      // Step 4: Validate (only if not dry run)
      if (!dryRun) {
        console.log('Step 4: Validating import resolution...');
        const validation = await updater.validateImports();
        
        if (!validation.passed) {
          console.error('✗ Import validation failed');
          console.error(`Found ${validation.issues.length} issues`);
          process.exit(1);
        }
        console.log('✓ Validation complete\n');
      }

      if (dryRun) {
        console.log('✓ Dry run complete. Use --execute to perform actual restructuring.');
      } else {
        console.log('✓ Directory restructuring complete!');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Cleanup command - Remove redundant files and directories
 */
program
  .command('cleanup')
  .description('Remove .DS_Store files, empty directories, and migration backup')
  .option('--dry-run', 'Show what would be removed without actually removing', true)
  .option('--execute', 'Execute actual cleanup (disables dry-run)')
  .action(async (options) => {
    try {
      const dryRun = !options.execute;
      
      console.log(`${dryRun ? '[DRY RUN] ' : ''}Starting cleanup...\n`);

      const { glob } = await import('glob');
      
      // Find .DS_Store files
      const dsStoreFiles = await glob('**/.DS_Store', {
        cwd: process.cwd(),
        ignore: ['**/node_modules/**']
      });

      console.log(`Found ${dsStoreFiles.length} .DS_Store files`);
      
      if (!dryRun) {
        for (const file of dsStoreFiles) {
          await fs.unlink(path.join(process.cwd(), file));
          console.log(`✓ Removed: ${file}`);
        }
      } else {
        dsStoreFiles.forEach(file => console.log(`  Would remove: ${file}`));
      }

      // Check for migration backup directory
      const backupDir = path.join(process.cwd(), 'migration-backup');
      try {
        await fs.access(backupDir);
        console.log('\nFound migration-backup directory');
        
        if (!dryRun) {
          await fs.rm(backupDir, { recursive: true, force: true });
          console.log('✓ Removed: migration-backup/');
        } else {
          console.log('  Would remove: migration-backup/');
        }
      } catch {
        console.log('\nNo migration-backup directory found');
      }

      if (dryRun) {
        console.log('\n✓ Dry run complete. Use --execute to perform actual cleanup.');
      } else {
        console.log('\n✓ Cleanup complete');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse();
