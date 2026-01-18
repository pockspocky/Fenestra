#!/usr/bin/env node

/**
 * Test Organizer CLI
 * 
 * Command-line interface for analyzing, consolidating, and migrating test files.
 * 
 * Commands:
 *   analyze    - Scan and catalog all test files
 *   consolidate - Generate consolidation plan for duplicate tests
 *   migrate    - Move tests to organized directory structure
 *   verify     - Verify tests still run after migration
 *   rollback   - Rollback migration using backup
 */

import { Command } from 'commander';
import { TestAnalyzer } from './TestAnalyzer.js';
import { TestConsolidator } from './TestConsolidator.js';
import { TestMigrator } from './TestMigrator.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('test-organizer')
  .description('Analyze, consolidate, and reorganize test files')
  .version('1.0.0');

// Analyze command
program
  .command('analyze')
  .description('Scan and catalog all test files')
  .option('-p, --pattern <pattern>', 'Test file pattern', 'test-*.js')
  .option('-o, --output <path>', 'Output file path', 'test-catalog.json')
  .option('-f, --format <format>', 'Output format (json|markdown)', 'json')
  .action(async (options) => {
    try {
      console.log('Analyzing test files...\n');
      
      const analyzer = new TestAnalyzer({
        testPattern: options.pattern
      });
      
      const catalog = await analyzer.analyzeTests();
      
      // Display summary
      console.log('\n=== Test Catalog Summary ===');
      console.log(`Total files: ${catalog.totalFiles}`);
      console.log(`Total tests: ${catalog.summary.totalTests}`);
      console.log('\nBy type:');
      for (const [type, count] of Object.entries(catalog.summary.byType)) {
        console.log(`  ${type}: ${count}`);
      }
      console.log('\nBy component:');
      const sortedComponents = Object.entries(catalog.summary.byComponent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      for (const [component, count] of sortedComponents) {
        console.log(`  ${component}: ${count}`);
      }
      console.log(`\nDuplicate groups: ${catalog.duplicates.length}`);
      console.log(`Orphaned tests: ${catalog.orphaned.length}`);
      
      // Export catalog
      if (options.format === 'json') {
        await fs.promises.writeFile(
          options.output,
          JSON.stringify(catalog, null, 2),
          'utf-8'
        );
        console.log(`\nCatalog exported to ${options.output}`);
      } else if (options.format === 'markdown') {
        const md = generateCatalogMarkdown(catalog);
        const mdPath = options.output.replace(/\.json$/, '.md');
        await fs.promises.writeFile(mdPath, md, 'utf-8');
        console.log(`\nCatalog exported to ${mdPath}`);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Consolidate command
program
  .command('consolidate')
  .description('Generate consolidation plan for duplicate tests')
  .option('-i, --input <path>', 'Input catalog file', 'test-catalog.json')
  .option('-o, --output <path>', 'Output plan file', 'consolidation-plan.json')
  .option('-f, --format <format>', 'Output format (json|markdown)', 'json')
  .action(async (options) => {
    try {
      console.log('Generating consolidation plan...\n');
      
      // Load catalog
      const catalogJson = await fs.promises.readFile(options.input, 'utf-8');
      const catalog = JSON.parse(catalogJson);
      
      const consolidator = new TestConsolidator();
      const plan = await consolidator.consolidate(catalog);
      
      // Display summary
      console.log('\n=== Consolidation Plan Summary ===');
      console.log(`Total duplicate groups: ${plan.totalDuplicates}`);
      console.log(`Files to merge: ${plan.summary.filesToMerge}`);
      console.log(`Files to review: ${plan.summary.filesToReview}`);
      console.log(`Files to keep separate: ${plan.summary.filesToKeep}`);
      console.log(`Estimated file reduction: ${plan.summary.estimatedReduction}`);
      
      // Export plan
      if (options.format === 'json') {
        await consolidator.exportPlan(plan, options.output);
      } else if (options.format === 'markdown') {
        const mdPath = options.output.replace(/\.json$/, '.md');
        await consolidator.exportMarkdown(plan, mdPath);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Migrate command
program
  .command('migrate')
  .description('Move tests to organized directory structure')
  .option('-i, --input <path>', 'Input catalog file', 'test-catalog.json')
  .option('-d, --tests-dir <path>', 'Tests directory', 'tests')
  .option('--dry-run', 'Preview changes without executing', false)
  .option('--no-backup', 'Skip backup creation', false)
  .action(async (options) => {
    try {
      console.log(options.dryRun ? 'DRY RUN: Previewing migration...\n' : 'Starting migration...\n');
      
      // Load catalog
      const catalogJson = await fs.promises.readFile(options.input, 'utf-8');
      const catalog = JSON.parse(catalogJson);
      
      const migrator = new TestMigrator({
        testsDir: options.testsDir,
        dryRun: options.dryRun,
        backup: options.backup
      });
      
      const result = await migrator.migrate(catalog, {});
      
      // Display summary
      console.log('\n=== Migration Summary ===');
      console.log(`Total files: ${result.totalFiles}`);
      console.log(`Moved: ${result.moved.length}`);
      console.log(`Failed: ${result.failed.length}`);
      console.log(`Skipped: ${result.skipped.length}`);
      console.log(`Imports updated: ${result.importsUpdated}`);
      
      if (result.backupPath) {
        console.log(`\nBackup created at: ${result.backupPath}`);
      }
      
      if (result.failed.length > 0) {
        console.log('\nFailed files:');
        for (const failure of result.failed) {
          console.log(`  ${failure.file}: ${failure.error}`);
        }
      }
      
      if (result.skipped.length > 0) {
        console.log('\nSkipped files:');
        for (const skip of result.skipped) {
          console.log(`  ${skip.file}: ${skip.reason}`);
        }
      }
      
      // Export result
      const resultPath = 'migration-result.json';
      await fs.promises.writeFile(
        resultPath,
        JSON.stringify(result, null, 2),
        'utf-8'
      );
      console.log(`\nMigration result exported to ${resultPath}`);
      
      if (!options.dryRun && result.moved.length > 0) {
        console.log('\nMigration complete! Run "npm test" to verify all tests still pass.');
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify tests still run after migration')
  .option('-d, --tests-dir <path>', 'Tests directory', 'tests')
  .action(async (options) => {
    try {
      console.log('Verifying tests...\n');
      
      const migrator = new TestMigrator({
        testsDir: options.testsDir
      });
      
      const result = await migrator.verifyTests();
      
      if (result.success) {
        console.log('✓ Tests verified successfully');
      } else {
        console.error('✗ Verification failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

// Rollback command
program
  .command('rollback')
  .description('Rollback migration using backup')
  .argument('<backup-path>', 'Path to backup directory')
  .action(async (backupPath) => {
    try {
      console.log('Rolling back migration...\n');
      
      const migrator = new TestMigrator();
      const result = await migrator.rollback(backupPath);
      
      if (result.success) {
        console.log('✓ Rollback complete');
      } else {
        console.error('✗ Rollback failed:', result.error);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

/**
 * Generates Markdown report from catalog
 * @param {TestCatalog} catalog - Test catalog
 * @returns {string} - Markdown content
 */
function generateCatalogMarkdown(catalog) {
  let md = '# Test Catalog\n\n';
  md += `Generated: ${catalog.timestamp}\n\n`;
  
  md += '## Summary\n\n';
  md += `- Total files: ${catalog.totalFiles}\n`;
  md += `- Total tests: ${catalog.summary.totalTests}\n`;
  md += `- Duplicate groups: ${catalog.duplicates.length}\n`;
  md += `- Orphaned tests: ${catalog.orphaned.length}\n\n`;
  
  md += '### By Type\n\n';
  for (const [type, count] of Object.entries(catalog.summary.byType)) {
    md += `- ${type}: ${count}\n`;
  }
  md += '\n';
  
  md += '### By Component\n\n';
  const sortedComponents = Object.entries(catalog.summary.byComponent)
    .sort((a, b) => b[1] - a[1]);
  for (const [component, count] of sortedComponents) {
    md += `- ${component}: ${count}\n`;
  }
  md += '\n';
  
  if (catalog.duplicates.length > 0) {
    md += '## Duplicate Groups\n\n';
    for (const dup of catalog.duplicates) {
      md += `### ${dup.description}\n\n`;
      md += `**Count:** ${dup.count}\n\n`;
      md += `**Recommendation:** ${dup.recommendation}\n\n`;
      md += '**Files:**\n';
      for (const file of dup.files) {
        md += `- ${file}\n`;
      }
      md += '\n';
    }
  }
  
  if (catalog.orphaned.length > 0) {
    md += '## Orphaned Tests\n\n';
    md += 'Tests without corresponding source files:\n\n';
    for (const file of catalog.orphaned) {
      md += `- ${file.path} (${file.component})\n`;
    }
    md += '\n';
  }
  
  md += '## All Test Files\n\n';
  for (const file of catalog.files) {
    md += `### ${file.name}\n\n`;
    md += `- **Path:** ${file.path}\n`;
    md += `- **Component:** ${file.component}\n`;
    md += `- **Type:** ${file.type}\n`;
    md += `- **Tests:** ${file.testCount}\n`;
    
    if (file.featureInfo && file.featureInfo.feature) {
      md += `- **Feature:** ${file.featureInfo.feature}\n`;
    }
    
    if (file.coverage.length > 0) {
      md += `- **Coverage:**\n`;
      for (const test of file.coverage.slice(0, 5)) {
        md += `  - ${test}\n`;
      }
      if (file.coverage.length > 5) {
        md += `  - ... and ${file.coverage.length - 5} more\n`;
      }
    }
    
    md += '\n';
  }
  
  return md;
}

program.parse();
