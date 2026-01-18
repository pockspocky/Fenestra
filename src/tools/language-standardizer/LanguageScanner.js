/**
 * Language Scanner - Detects non-English content in source files
 * Validates: Requirements 1.1, 2.1
 */

import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export class LanguageScanner {
  constructor() {
    // Unicode ranges for non-English languages
    this.patterns = {
      chinese: /[\u4e00-\u9fff]/g,
      japanese: /[\u3040-\u309f\u30a0-\u30ff]/g,
      korean: /[\uac00-\ud7af]/g
    };
  }

  /**
   * Scans files for non-English content
   * @param {string[]} filePaths - Paths to scan
   * @param {Object} options - Scan options
   * @returns {Promise<ScanResult[]>}
   */
  async scanFiles(filePaths, options = {}) {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileResults = this.scanContent(content, filePath);
        results.push(...fileResults);
      } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        results.push({
          filePath,
          error: error.message,
          type: 'error'
        });
      }
    }
    
    return results;
  }

  /**
   * Scans content for non-English characters
   * @param {string} content - Content to scan
   * @param {string} filePath - File path for reporting
   * @returns {ScanResult[]}
   */
  scanContent(content, filePath) {
    const results = [];
    const lines = content.split('\n');
    
    // Extract comments, JSDoc, and string literals
    const extractedContent = this.extractRelevantContent(content);
    
    for (const item of extractedContent) {
      const matches = this.detectNonEnglish(item.content);
      
      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, item.startIndex + match.index);
        const columnNumber = this.getColumnNumber(content, item.startIndex + match.index);
        const context = this.getContext(lines, lineNumber);
        
        results.push({
          filePath,
          lineNumber,
          columnNumber,
          content: match.text,
          context,
          type: item.type,
          language: match.language
        });
      }
    }
    
    return results;
  }

  /**
   * Extracts comments, JSDoc, and string literals from JavaScript content
   * @param {string} content - JavaScript content
   * @returns {Array<{type: string, content: string, startIndex: number}>}
   */
  extractRelevantContent(content) {
    const extracted = [];
    
    // Extract single-line comments
    const singleLineCommentRegex = /\/\/(.*)$/gm;
    let match;
    while ((match = singleLineCommentRegex.exec(content)) !== null) {
      extracted.push({
        type: 'comment',
        content: match[1],
        startIndex: match.index
      });
    }
    
    // Extract multi-line comments and JSDoc
    const multiLineCommentRegex = /\/\*\*([\s\S]*?)\*\/|\/\*([\s\S]*?)\*\//g;
    while ((match = multiLineCommentRegex.exec(content)) !== null) {
      const isJSDoc = match[0].startsWith('/**');
      extracted.push({
        type: isJSDoc ? 'jsdoc' : 'comment',
        content: match[1] || match[2],
        startIndex: match.index
      });
    }
    
    // Extract string literals (single and double quotes)
    const stringRegex = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    while ((match = stringRegex.exec(content)) !== null) {
      extracted.push({
        type: 'string',
        content: match[2],
        startIndex: match.index
      });
    }
    
    return extracted;
  }

  /**
   * Detects non-English characters using Unicode ranges
   * @param {string} content - Content to check
   * @returns {Array<{text: string, language: string, index: number}>}
   */
  detectNonEnglish(content) {
    const matches = [];
    
    for (const [language, pattern] of Object.entries(this.patterns)) {
      let match;
      const regex = new RegExp(pattern.source, 'g');
      
      while ((match = regex.exec(content)) !== null) {
        matches.push({
          text: match[0],
          language,
          index: match.index
        });
      }
    }
    
    return matches;
  }

  /**
   * Gets line number from character index
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number}
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Gets column number from character index
   * @param {string} content - Full content
   * @param {number} index - Character index
   * @returns {number}
   */
  getColumnNumber(content, index) {
    const lastNewline = content.lastIndexOf('\n', index);
    return index - lastNewline;
  }

  /**
   * Gets surrounding context for a line
   * @param {string[]} lines - All lines
   * @param {number} lineNumber - Target line number (1-indexed)
   * @returns {string}
   */
  getContext(lines, lineNumber) {
    const contextLines = 2;
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end).join('\n');
  }

  /**
   * Scans directory with glob pattern
   * @param {string} pattern - Glob pattern
   * @param {Object} options - Scan options
   * @returns {Promise<ScanResult[]>}
   */
  async scanPattern(pattern, options = {}) {
    const files = await glob(pattern, {
      ignore: options.ignore || ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
      absolute: true
    });
    
    return this.scanFiles(files, options);
  }
}
