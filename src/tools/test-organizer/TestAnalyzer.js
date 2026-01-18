/**
 * Test Analyzer
 * 
 * Scans all test files in the project root and extracts metadata including:
 * - Component being tested
 * - Test type (unit, integration, property-based)
 * - Test coverage (what functionality is tested)
 * - Dependencies (imports and modules used)
 * 
 * Generates a comprehensive test catalog for analysis and reorganization.
 */

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export class TestAnalyzer {
  constructor(options = {}) {
    this.rootDir = options.rootDir || process.cwd();
    this.testPattern = options.testPattern || 'test-*.js';
    this.excludePatterns = options.excludePatterns || ['node_modules/**', 'tests/**'];
  }

  /**
   * Scans all test files and generates a comprehensive catalog
   * @returns {Promise<TestCatalog>}
   */
  async analyzeTests() {
    console.log('Scanning for test files...');
    
    const testFiles = await this.findTestFiles();
    console.log(`Found ${testFiles.length} test files`);
    
    const catalog = {
      timestamp: new Date().toISOString(),
      totalFiles: testFiles.length,
      files: [],
      duplicates: [],
      orphaned: [],
      summary: {
        byType: {},
        byComponent: {},
        totalTests: 0
      }
    };
    
    for (const filePath of testFiles) {
      try {
        const metadata = await this.extractTestMetadata(filePath);
        catalog.files.push(metadata);
        
        // Update summary
        catalog.summary.byType[metadata.type] = (catalog.summary.byType[metadata.type] || 0) + 1;
        catalog.summary.byComponent[metadata.component] = (catalog.summary.byComponent[metadata.component] || 0) + 1;
        catalog.summary.totalTests += metadata.testCount;
      } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error.message);
        catalog.files.push({
          path: filePath,
          name: path.basename(filePath),
          error: error.message,
          type: 'unknown',
          component: 'unknown',
          testCount: 0,
          coverage: [],
          dependencies: []
        });
      }
    }
    
    // Identify duplicates
    catalog.duplicates = this.findDuplicates(catalog.files);
    
    // Identify orphaned tests (tests that don't match any source file)
    catalog.orphaned = this.findOrphanedTests(catalog.files);
    
    return catalog;
  }

  /**
   * Finds all test files matching the pattern
   * @returns {Promise<string[]>}
   */
  async findTestFiles() {
    const pattern = path.join(this.rootDir, this.testPattern);
    const files = await glob(pattern, {
      ignore: this.excludePatterns,
      absolute: false
    });
    
    return files.map(f => path.relative(this.rootDir, f));
  }

  /**
   * Extracts metadata from a test file
   * @param {string} filePath - Path to test file
   * @returns {Promise<TestFile>}
   */
  async extractTestMetadata(filePath) {
    const absolutePath = path.join(this.rootDir, filePath);
    const content = await fs.promises.readFile(absolutePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    // Extract component name from filename
    const component = this.extractComponentName(fileName);
    
    // Determine test type
    const type = this.determineTestType(fileName, content);
    
    // Extract test descriptions
    const coverage = this.extractTestCoverage(content);
    
    // Extract dependencies
    const dependencies = this.extractDependencies(content);
    
    // Count tests
    const testCount = this.countTests(content);
    
    // Extract feature and property information
    const featureInfo = this.extractFeatureInfo(content);
    
    return {
      path: filePath,
      name: fileName,
      component,
      type,
      testCount,
      coverage,
      dependencies,
      featureInfo,
      size: content.length,
      lines: content.split('\n').length
    };
  }

  /**
   * Extracts component name from test filename
   * @param {string} fileName - Test file name
   * @returns {string}
   */
  extractComponentName(fileName) {
    // Remove 'test-' prefix and '.js' suffix
    let component = fileName.replace(/^test-/, '').replace(/\.js$/, '');
    
    // Handle different naming patterns
    if (component.includes('-property')) {
      component = component.replace(/-property$/, '');
    } else if (component.includes('-integration')) {
      component = component.replace(/-integration$/, '');
    } else if (component.includes('-unit')) {
      component = component.replace(/-unit$/, '');
    }
    
    return component;
  }

  /**
   * Determines test type from filename and content
   * @param {string} fileName - Test file name
   * @param {string} content - File content
   * @returns {string}
   */
  determineTestType(fileName, content) {
    // Check filename patterns
    if (fileName.includes('-property')) {
      return 'property-based';
    } else if (fileName.includes('-integration')) {
      return 'integration';
    } else if (fileName.includes('-unit')) {
      return 'unit';
    }
    
    // Check content patterns
    if (content.includes('fc.property') || content.includes('fast-check')) {
      return 'property-based';
    } else if (content.includes('Integration Test') || content.includes('integration')) {
      return 'integration';
    } else if (content.includes('Unit Test') || content.includes('unit test')) {
      return 'unit';
    }
    
    // Default to unit test
    return 'unit';
  }

  /**
   * Extracts test coverage information (test descriptions)
   * @param {string} content - File content
   * @returns {string[]}
   */
  extractTestCoverage(content) {
    const coverage = [];
    
    // Match test() calls
    const testRegex = /test\s*\(\s*['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = testRegex.exec(content)) !== null) {
      coverage.push(match[1]);
    }
    
    // Match describe() calls
    const describeRegex = /describe\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = describeRegex.exec(content)) !== null) {
      coverage.push(match[1]);
    }
    
    // Match it() calls
    const itRegex = /it\s*\(\s*['"`]([^'"`]+)['"`]/g;
    while ((match = itRegex.exec(content)) !== null) {
      coverage.push(match[1]);
    }
    
    // Match console.log test descriptions
    const consoleRegex = /console\.log\s*\(\s*['"`]Test \d+:\s*([^'"`]+)['"`]/g;
    while ((match = consoleRegex.exec(content)) !== null) {
      coverage.push(match[1]);
    }
    
    return [...new Set(coverage)]; // Remove duplicates
  }

  /**
   * Extracts dependencies from import statements
   * @param {string} content - File content
   * @returns {string[]}
   */
  extractDependencies(content) {
    const dependencies = [];
    
    // Match ES6 imports
    const importRegex = /import\s+(?:{[^}]+}|[^from]+)\s+from\s+['"`]([^'"`]+)['"`]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    // Match require statements
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Counts the number of tests in a file
   * @param {string} content - File content
   * @returns {number}
   */
  countTests(content) {
    let count = 0;
    
    // Count test() calls
    count += (content.match(/\btest\s*\(/g) || []).length;
    
    // Count it() calls
    count += (content.match(/\bit\s*\(/g) || []).length;
    
    // Count console.log test descriptions (for custom test runners)
    count += (content.match(/console\.log\s*\(\s*['"`]Test \d+:/g) || []).length;
    
    return count;
  }

  /**
   * Extracts feature and property information from comments
   * @param {string} content - File content
   * @returns {Object}
   */
  extractFeatureInfo(content) {
    const info = {
      feature: null,
      properties: [],
      requirements: []
    };
    
    // Extract feature name
    const featureMatch = content.match(/Feature:\s*([^\n,]+)/);
    if (featureMatch) {
      info.feature = featureMatch[1].trim();
    }
    
    // Extract property numbers
    const propertyRegex = /Property\s+(\d+(?:\.\d+)?)/g;
    let match;
    while ((match = propertyRegex.exec(content)) !== null) {
      info.properties.push(match[1]);
    }
    
    // Extract requirement references
    const reqRegex = /Requirements?:\s*([^\n]+)/g;
    while ((match = reqRegex.exec(content)) !== null) {
      const reqs = match[1].split(',').map(r => r.trim());
      info.requirements.push(...reqs);
    }
    
    return info;
  }

  /**
   * Identifies duplicate test coverage
   * @param {TestFile[]} files - Test files
   * @returns {DuplicateGroup[]}
   */
  findDuplicates(files) {
    const duplicates = [];
    const coverageMap = new Map();
    
    // Group files by similar coverage
    for (const file of files) {
      for (const testDesc of file.coverage) {
        if (!coverageMap.has(testDesc)) {
          coverageMap.set(testDesc, []);
        }
        coverageMap.get(testDesc).push(file);
      }
    }
    
    // Find groups with multiple files
    for (const [testDesc, fileList] of coverageMap.entries()) {
      if (fileList.length > 1) {
        duplicates.push({
          description: testDesc,
          files: fileList.map(f => f.path),
          count: fileList.length,
          recommendation: this.getDuplicateRecommendation(fileList)
        });
      }
    }
    
    // Also check for files testing the same component
    const componentMap = new Map();
    for (const file of files) {
      if (!componentMap.has(file.component)) {
        componentMap.set(file.component, []);
      }
      componentMap.get(file.component).push(file);
    }
    
    for (const [component, fileList] of componentMap.entries()) {
      if (fileList.length > 1 && component !== 'unknown') {
        // Check if they're different types (unit, integration, property)
        const types = new Set(fileList.map(f => f.type));
        if (types.size === fileList.length) {
          // Different types - probably intentional
          continue;
        }
        
        duplicates.push({
          description: `Multiple tests for component: ${component}`,
          files: fileList.map(f => f.path),
          count: fileList.length,
          recommendation: 'review' // Need manual review
        });
      }
    }
    
    return duplicates;
  }

  /**
   * Determines recommendation for duplicate tests
   * @param {TestFile[]} files - Duplicate files
   * @returns {string}
   */
  getDuplicateRecommendation(files) {
    // If all files are the same type, recommend merge
    const types = new Set(files.map(f => f.type));
    if (types.size === 1) {
      return 'merge';
    }
    
    // If different types, keep separate
    return 'keep-separate';
  }

  /**
   * Identifies orphaned tests (tests without corresponding source files)
   * @param {TestFile[]} files - Test files
   * @returns {TestFile[]}
   */
  findOrphanedTests(files) {
    const orphaned = [];
    
    for (const file of files) {
      // Check if corresponding source file exists
      const possiblePaths = [
        `src/core/${file.component}.js`,
        `src/core/systems/${file.component}.js`,
        `src/core/handlers/${file.component}.js`,
        `src/core/utils/${file.component}.js`,
        `src/core/callbacks/${file.component}.js`,
        `src/core/security/${file.component}.js`
      ];
      
      const exists = possiblePaths.some(p => {
        try {
          return fs.existsSync(path.join(this.rootDir, p));
        } catch {
          return false;
        }
      });
      
      if (!exists && file.component !== 'unknown') {
        orphaned.push(file);
      }
    }
    
    return orphaned;
  }
}
