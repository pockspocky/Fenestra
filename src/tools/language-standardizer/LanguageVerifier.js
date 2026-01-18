/**
 * Language Verifier - Verifies translation completion
 * Validates: Requirements 1.4, 1.5, 2.3, 2.5
 */

import fs from 'fs/promises';
import { LanguageScanner } from './LanguageScanner.js';

export class LanguageVerifier {
  constructor() {
    this.scanner = new LanguageScanner();
  }

  /**
   * Verifies previously identified locations are now English
   * @param {Report} originalReport - Original scan report
   * @returns {Promise<VerificationResult>}
   */
  async verify(originalReport) {
    // Get unique file paths from original report
    const filePaths = [...new Set(originalReport.results.map(r => r.filePath))];
    
    // Re-scan the files
    const currentResults = await this.scanner.scanFiles(filePaths);
    
    // Compare results
    const comparison = this.compareResults(originalReport.results, currentResults);
    
    return {
      passed: comparison.remainingIssues.length === 0 && comparison.newIssues.length === 0,
      remainingIssues: comparison.remainingIssues,
      resolvedIssues: comparison.resolvedCount,
      newIssues: comparison.newIssues,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Compares original and current scan results
   * @param {ScanResult[]} originalResults - Original scan results
   * @param {ScanResult[]} currentResults - Current scan results
   * @returns {Object}
   */
  compareResults(originalResults, currentResults) {
    const remainingIssues = [];
    const newIssues = [];
    let resolvedCount = 0;
    
    // Create a map of current issues for quick lookup
    const currentIssuesMap = new Map();
    for (const result of currentResults) {
      const key = this.createIssueKey(result);
      currentIssuesMap.set(key, result);
    }
    
    // Check which original issues still exist
    for (const original of originalResults) {
      const key = this.createIssueKey(original);
      if (currentIssuesMap.has(key)) {
        remainingIssues.push(original);
        currentIssuesMap.delete(key);
      } else {
        resolvedCount++;
      }
    }
    
    // Remaining items in currentIssuesMap are new issues
    newIssues.push(...currentIssuesMap.values());
    
    return {
      remainingIssues,
      resolvedCount,
      newIssues
    };
  }

  /**
   * Creates a unique key for an issue
   * @param {ScanResult} result - Scan result
   * @returns {string}
   */
  createIssueKey(result) {
    return `${result.filePath}:${result.lineNumber}:${result.columnNumber}:${result.language}`;
  }

  /**
   * Generates verification report
   * @param {VerificationResult} verificationResult - Verification result
   * @returns {string}
   */
  generateVerificationReport(verificationResult) {
    let report = '# Language Verification Report\n\n';
    report += `**Generated:** ${verificationResult.timestamp}\n\n`;
    
    report += '## Summary\n\n';
    report += `- **Status:** ${verificationResult.passed ? '✅ PASSED' : '❌ FAILED'}\n`;
    report += `- **Resolved Issues:** ${verificationResult.resolvedIssues}\n`;
    report += `- **Remaining Issues:** ${verificationResult.remainingIssues.length}\n`;
    report += `- **New Issues:** ${verificationResult.newIssues.length}\n\n`;
    
    if (verificationResult.remainingIssues.length > 0) {
      report += '## Remaining Issues\n\n';
      report += 'These issues from the original report still exist:\n\n';
      
      for (const issue of verificationResult.remainingIssues) {
        report += `- **${issue.filePath}** (Line ${issue.lineNumber}, Column ${issue.columnNumber})\n`;
        report += `  - Type: ${issue.type}, Language: ${issue.language}\n`;
        report += `  - Content: \`${issue.content}\`\n\n`;
      }
    }
    
    if (verificationResult.newIssues.length > 0) {
      report += '## New Issues\n\n';
      report += 'These issues were not in the original report:\n\n';
      
      for (const issue of verificationResult.newIssues) {
        report += `- **${issue.filePath}** (Line ${issue.lineNumber}, Column ${issue.columnNumber})\n`;
        report += `  - Type: ${issue.type}, Language: ${issue.language}\n`;
        report += `  - Content: \`${issue.content}\`\n\n`;
      }
    }
    
    if (verificationResult.passed) {
      report += '## ✅ Verification Passed\n\n';
      report += 'All previously identified non-English content has been successfully translated or removed.\n';
    } else {
      report += '## ❌ Verification Failed\n\n';
      report += 'Some issues remain. Please review the remaining and new issues above.\n';
    }
    
    return report;
  }

  /**
   * Exports verification report to file
   * @param {VerificationResult} verificationResult - Verification result
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportVerificationReport(verificationResult, outputPath) {
    try {
      const report = this.generateVerificationReport(verificationResult);
      await fs.mkdir(require('path').dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, report, 'utf-8');
      console.log(`Verification report exported to: ${outputPath}`);
    } catch (error) {
      console.error(`Error exporting verification report:`, error.message);
      // Fallback to console output
      console.log(this.generateVerificationReport(verificationResult));
    }
  }

  /**
   * Loads original report from file
   * @param {string} reportPath - Path to original report JSON
   * @returns {Promise<Report>}
   */
  async loadOriginalReport(reportPath) {
    try {
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to load original report: ${error.message}`);
    }
  }
}
