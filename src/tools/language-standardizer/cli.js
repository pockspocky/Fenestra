#!/usr/bin/env node

/**
 * Language Standardizer CLI
 * Command-line interface for scanning, reporting, and verifying non-English content
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.5
 */

import { Command } from 'commander';
import { LanguageScanner } from './LanguageScanner.js';
import { LanguageReporter } from './LanguageReporter.js';
import { LanguageVerifier } from './LanguageVerifier.js';
import path from 'path';

const program = new Command();

program
  .name('language-standardizer')
  .description('Tool for detecting and verifying non-English content in source files')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Scan files for non-English content')
  .argument('<pattern>', 'Glob pattern for files to scan (e.g., "src/**/*.js")')
  .option('-o, --output <path>', 'Output path for report', './language-report')
  .option('-f, --format <format>', 'Output format: json, markdown, csv, or all', 'all')
  .option('--ignore <patterns...>', 'Patterns to ignore', ['node_modules/**', '.git/**', 'dist/**', 'build/**'])
  .action(async (pattern, options) => {
    try {
      console.log(`Scanning files matching: ${pattern}`);
      console.log(`Ignoring: ${options.ignore.join(', ')}`);
      
      const scanner = new LanguageScanner();
      const results = await scanner.scanPattern(pattern, { ignore: options.ignore });
      
      const reporter = new LanguageReporter();
      const report = reporter.generateReport(results);
      
      console.log(`\nScan complete!`);
      console.log(`- Total files scanned: ${report.totalFiles}`);
      console.log(`- Files with issues: ${report.filesWithIssues}`);
      console.log(`- Total issues found: ${report.totalIssues}`);
      
      if (report.errors > 0) {
        console.log(`- Errors: ${report.errors}`);
      }
      
      // Export reports
      const formats = options.format === 'all' ? ['json', 'markdown', 'csv'] : [options.format];
      
      for (const format of formats) {
        const ext = format === 'markdown' ? 'md' : format;
        const outputPath = `${options.output}.${ext}`;
        await reporter.export(report, format, outputPath);
      }
      
      console.log(`\nReports generated successfully!`);
      
      // Exit with error code if issues found
      if (report.totalIssues > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error during scan:`, error.message);
      process.exit(1);
    }
  });

// Verify command
program
  .command('verify')
  .description('Verify that previously identified issues have been resolved')
  .argument('<report>', 'Path to original report JSON file')
  .option('-o, --output <path>', 'Output path for verification report', './verification-report.md')
  .action(async (reportPath, options) => {
    try {
      console.log(`Loading original report from: ${reportPath}`);
      
      const verifier = new LanguageVerifier();
      const originalReport = await verifier.loadOriginalReport(reportPath);
      
      console.log(`Verifying ${originalReport.totalIssues} issues from original report...`);
      
      const verificationResult = await verifier.verify(originalReport);
      
      console.log(`\nVerification complete!`);
      console.log(`- Status: ${verificationResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`- Resolved issues: ${verificationResult.resolvedIssues}`);
      console.log(`- Remaining issues: ${verificationResult.remainingIssues.length}`);
      console.log(`- New issues: ${verificationResult.newIssues.length}`);
      
      await verifier.exportVerificationReport(verificationResult, options.output);
      
      console.log(`\nVerification report generated: ${options.output}`);
      
      // Exit with error code if verification failed
      if (!verificationResult.passed) {
        process.exit(1);
      }
    } catch (error) {
      console.error(`Error during verification:`, error.message);
      process.exit(1);
    }
  });

// Report command (generate report from existing scan results)
program
  .command('report')
  .description('Generate report from scan results JSON')
  .argument('<input>', 'Path to scan results JSON file')
  .option('-o, --output <path>', 'Output path for report', './language-report')
  .option('-f, --format <format>', 'Output format: json, markdown, csv, or all', 'markdown')
  .action(async (inputPath, options) => {
    try {
      console.log(`Loading scan results from: ${inputPath}`);
      
      const fs = await import('fs/promises');
      const content = await fs.readFile(inputPath, 'utf-8');
      const report = JSON.parse(content);
      
      const reporter = new LanguageReporter();
      
      // Export reports
      const formats = options.format === 'all' ? ['json', 'markdown', 'csv'] : [options.format];
      
      for (const format of formats) {
        const ext = format === 'markdown' ? 'md' : format;
        const outputPath = `${options.output}.${ext}`;
        await reporter.export(report, format, outputPath);
      }
      
      console.log(`\nReports generated successfully!`);
    } catch (error) {
      console.error(`Error generating report:`, error.message);
      process.exit(1);
    }
  });

// Examples command
program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log(`
Language Standardizer - Usage Examples

1. Scan all JavaScript files in src directory:
   $ language-standardizer scan "src/**/*.js"

2. Scan with custom output path and format:
   $ language-standardizer scan "src/**/*.js" -o ./reports/language -f json

3. Scan with custom ignore patterns:
   $ language-standardizer scan "**/*.js" --ignore "node_modules/**" "test/**"

4. Verify translation completion:
   $ language-standardizer verify ./language-report.json

5. Generate markdown report from existing scan:
   $ language-standardizer report ./language-report.json -f markdown

6. Scan and export all formats:
   $ language-standardizer scan "src/**/*.js" -f all

For more information, use --help with any command.
    `);
  });

program.parse();
