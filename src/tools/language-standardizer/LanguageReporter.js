/**
 * Language Reporter - Generates comprehensive reports of scan results
 * Validates: Requirements 1.2, 1.3, 2.2
 */

import fs from 'fs/promises';
import path from 'path';

export class LanguageReporter {
  /**
   * Generates comprehensive report of findings
   * @param {ScanResult[]} results - Scan results
   * @returns {Report}
   */
  generateReport(results) {
    const validResults = results.filter(r => !r.error);
    const errorResults = results.filter(r => r.error);
    
    const filesWithIssues = new Set(validResults.map(r => r.filePath));
    
    const report = {
      timestamp: new Date().toISOString(),
      totalFiles: new Set([...validResults.map(r => r.filePath), ...errorResults.map(r => r.filePath)]).size,
      filesWithIssues: filesWithIssues.size,
      totalIssues: validResults.length,
      errors: errorResults.length,
      results: validResults,
      errorResults,
      summary: this.generateSummary(validResults)
    };
    
    return report;
  }

  /**
   * Generates summary statistics
   * @param {ScanResult[]} results - Scan results
   * @returns {Object}
   */
  generateSummary(results) {
    const byType = {};
    const byLanguage = {};
    const byFile = {};
    
    for (const result of results) {
      // Count by type
      byType[result.type] = (byType[result.type] || 0) + 1;
      
      // Count by language
      byLanguage[result.language] = (byLanguage[result.language] || 0) + 1;
      
      // Count by file
      byFile[result.filePath] = (byFile[result.filePath] || 0) + 1;
    }
    
    return { byType, byLanguage, byFile };
  }

  /**
   * Exports report to JSON format
   * @param {Report} report - Report to export
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportJSON(report, outputPath) {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(report, null, 2), 'utf-8');
      console.log(`JSON report exported to: ${outputPath}`);
    } catch (error) {
      console.error(`Error exporting JSON report:`, error.message);
      // Fallback to console output
      console.log(JSON.stringify(report, null, 2));
    }
  }

  /**
   * Exports report to Markdown format
   * @param {Report} report - Report to export
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportMarkdown(report, outputPath) {
    try {
      const markdown = this.generateMarkdown(report);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, markdown, 'utf-8');
      console.log(`Markdown report exported to: ${outputPath}`);
    } catch (error) {
      console.error(`Error exporting Markdown report:`, error.message);
      // Fallback to console output
      console.log(this.generateMarkdown(report));
    }
  }

  /**
   * Generates Markdown formatted report
   * @param {Report} report - Report to format
   * @returns {string}
   */
  generateMarkdown(report) {
    let md = '# Language Standardization Report\n\n';
    md += `**Generated:** ${report.timestamp}\n\n`;
    
    md += '## Summary\n\n';
    md += `- **Total Files Scanned:** ${report.totalFiles}\n`;
    md += `- **Files with Issues:** ${report.filesWithIssues}\n`;
    md += `- **Total Issues:** ${report.totalIssues}\n`;
    if (report.errors > 0) {
      md += `- **Errors:** ${report.errors}\n`;
    }
    md += '\n';
    
    // Summary by type
    md += '### Issues by Type\n\n';
    for (const [type, count] of Object.entries(report.summary.byType)) {
      md += `- **${type}:** ${count}\n`;
    }
    md += '\n';
    
    // Summary by language
    md += '### Issues by Language\n\n';
    for (const [language, count] of Object.entries(report.summary.byLanguage)) {
      md += `- **${language}:** ${count}\n`;
    }
    md += '\n';
    
    // Summary by file
    md += '### Issues by File\n\n';
    const sortedFiles = Object.entries(report.summary.byFile)
      .sort((a, b) => b[1] - a[1]);
    
    for (const [file, count] of sortedFiles) {
      md += `- **${file}:** ${count} issue(s)\n`;
    }
    md += '\n';
    
    // Detailed results
    md += '## Detailed Results\n\n';
    
    const resultsByFile = {};
    for (const result of report.results) {
      if (!resultsByFile[result.filePath]) {
        resultsByFile[result.filePath] = [];
      }
      resultsByFile[result.filePath].push(result);
    }
    
    for (const [file, results] of Object.entries(resultsByFile)) {
      md += `### ${file}\n\n`;
      
      for (const result of results) {
        md += `**Line ${result.lineNumber}, Column ${result.columnNumber}** (${result.type}, ${result.language})\n`;
        md += '```\n';
        md += result.context;
        md += '\n```\n\n';
      }
    }
    
    // Errors section
    if (report.errorResults && report.errorResults.length > 0) {
      md += '## Errors\n\n';
      for (const error of report.errorResults) {
        md += `- **${error.filePath}:** ${error.error}\n`;
      }
      md += '\n';
    }
    
    return md;
  }

  /**
   * Exports report to CSV format
   * @param {Report} report - Report to export
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async exportCSV(report, outputPath) {
    try {
      const csv = this.generateCSV(report);
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, csv, 'utf-8');
      console.log(`CSV report exported to: ${outputPath}`);
    } catch (error) {
      console.error(`Error exporting CSV report:`, error.message);
      // Fallback to console output
      console.log(this.generateCSV(report));
    }
  }

  /**
   * Generates CSV formatted report
   * @param {Report} report - Report to format
   * @returns {string}
   */
  generateCSV(report) {
    const headers = ['File Path', 'Line Number', 'Column Number', 'Type', 'Language', 'Content'];
    let csv = headers.join(',') + '\n';
    
    for (const result of report.results) {
      const row = [
        `"${result.filePath}"`,
        result.lineNumber,
        result.columnNumber,
        result.type,
        result.language,
        `"${result.content.replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  /**
   * Exports report in specified format
   * @param {Report} report - Report to export
   * @param {string} format - 'json' | 'markdown' | 'csv'
   * @param {string} outputPath - Output file path
   * @returns {Promise<void>}
   */
  async export(report, format, outputPath) {
    switch (format.toLowerCase()) {
      case 'json':
        await this.exportJSON(report, outputPath);
        break;
      case 'markdown':
      case 'md':
        await this.exportMarkdown(report, outputPath);
        break;
      case 'csv':
        await this.exportCSV(report, outputPath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}
