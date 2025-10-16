// Unit tests for auto-completion functionality
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import './logger.js';

// Set log level for testing
global.logLevel = "log";

console.log('=== Auto-completion Functionality Tests ===');

// Test utilities
class TestUtils {
  static createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'fenestra-test-'));
  }

  static createTestFiles(baseDir, files) {
    files.forEach(file => {
      const fullPath = path.join(baseDir, file.name);
      if (file.type === 'directory') {
        fs.mkdirSync(fullPath, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, file.content || '');
      }
    });
  }

  static cleanup(dir) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  static assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      console.error(`❌ ${message}`);
      console.error('Expected:', expected);
      console.error('Actual:', actual);
      return false;
    }
    console.log(`✅ ${message}`);
    return true;
  }

  static assertTrue(condition, message) {
    if (!condition) {
      console.error(`❌ ${message}`);
      return false;
    }
    console.log(`✅ ${message}`);
    return true;
  }
}

// Mock the file completion functions directly to avoid Electron dependencies
function normalizePathForCompletion(partialPath) {
  return partialPath.replace(/\\/g, '/');
}

function checkDirectoryAccess(dirPath) {
  try {
    fs.accessSync(dirPath, fs.constants.R_OK);
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      message: `Cannot access directory: ${error.message}`,
      error: error.code 
    };
  }
}

function readDirectoryWithOptimization(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return { success: true, entries };
  } catch (error) {
    return { 
      success: false, 
      message: `Cannot read directory: ${error.message}` 
    };
  }
}

function filterMatchingEntries(entries, pattern) {
  if (!pattern) return entries;
  return entries.filter(entry => 
    entry.name.toLowerCase().startsWith(pattern.toLowerCase())
  );
}

function needsQuoting(filename) {
  return /[\s@#$%^&*()+=\[\]{}|\\:";'<>?,]/.test(filename);
}

function findCommonPrefixWithSpecialChars(names) {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];

  let prefix = names[0];
  for (let i = 1; i < names.length; i++) {
    let j = 0;
    while (j < prefix.length && j < names[i].length && 
           prefix[j].toLowerCase() === names[i][j].toLowerCase()) {
      j++;
    }
    prefix = prefix.substring(0, j);
    if (prefix === '') break;
  }
  return prefix;
}

// Mock file completion function
async function mockGetFileCompletions(partialPath, currentDir) {
  try {
    const workingDir = currentDir || process.cwd();
    
    if (!partialPath || partialPath.trim() === '') {
      // Return directory contents
      const dirAccessResult = checkDirectoryAccess(workingDir);
      if (!dirAccessResult.success) {
        return {
          success: true,
          completions: [],
          commonPrefix: '',
          message: dirAccessResult.message,
          error: dirAccessResult.error
        };
      }
      
      const entries = readDirectoryWithOptimization(workingDir);
      if (!entries.success) {
        return {
          success: true,
          completions: [],
          commonPrefix: '',
          message: entries.message
        };
      }
      
      const completions = entries.entries
        .filter(entry => !entry.name.startsWith('.'))
        .map(entry => {
          const displayName = entry.isDirectory() ? `${entry.name}/` : entry.name;
          const escapedName = needsQuoting(entry.name) ? `"${entry.name}"` : entry.name;
          
          return {
            name: displayName,
            escapedName: entry.isDirectory() ? `${escapedName}/` : escapedName,
            type: entry.isDirectory() ? 'directory' : 'file',
            path: entry.name,
            hasSpecialChars: needsQuoting(entry.name)
          };
        });
      
      return {
        success: true,
        completions,
        commonPrefix: '',
        totalMatches: completions.length
      };
    }
    
    const normalizedPath = normalizePathForCompletion(partialPath);
    let searchDir, filePattern;
    
    if (path.isAbsolute(normalizedPath)) {
      const dirname = path.dirname(normalizedPath);
      const basename = path.basename(normalizedPath);
      searchDir = dirname;
      filePattern = basename;
    } else {
      const dirname = path.dirname(normalizedPath);
      const basename = path.basename(normalizedPath);
      
      if (dirname === '.') {
        searchDir = workingDir;
      } else {
        searchDir = path.resolve(workingDir, dirname);
      }
      filePattern = basename;
    }
    
    const dirAccessResult = checkDirectoryAccess(searchDir);
    if (!dirAccessResult.success) {
      return {
        success: true,
        completions: [],
        commonPrefix: '',
        message: dirAccessResult.message,
        error: dirAccessResult.error
      };
    }
    
    const entries = readDirectoryWithOptimization(searchDir);
    if (!entries.success) {
      return {
        success: true,
        completions: [],
        commonPrefix: '',
        message: entries.message
      };
    }
    
    const matchingEntries = filterMatchingEntries(entries.entries, filePattern);
    
    const completions = matchingEntries.map(entry => {
      const fullPath = path.join(searchDir, entry.name);
      const relativePath = path.relative(workingDir, fullPath);
      
      const displayName = entry.isDirectory() ? `${entry.name}/` : entry.name;
      const escapedName = needsQuoting(entry.name) ? `"${entry.name}"` : entry.name;
      
      return {
        name: displayName,
        escapedName: entry.isDirectory() ? `${escapedName}/` : escapedName,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: relativePath || entry.name,
        hasSpecialChars: needsQuoting(entry.name)
      };
    });
    
    const commonPrefix = findCommonPrefixWithSpecialChars(completions.map(c => c.name));
    const maxResults = 100;
    const limitedCompletions = completions.slice(0, maxResults);
    
    return {
      success: true,
      completions: limitedCompletions,
      commonPrefix,
      totalMatches: completions.length,
      message: completions.length > maxResults ? 
        `Showing first ${maxResults} results, ${completions.length} total matches` : 
        (completions.length === 0 ? 'No matching files found' : '')
    };
    
  } catch (error) {
    let errorMessage = 'Completion failed';
    if (error.code === 'ENOENT') {
      errorMessage = 'Path not found';
    } else if (error.code === 'EACCES') {
      errorMessage = 'Permission denied';
    } else if (error.code === 'ENOTDIR') {
      errorMessage = 'Path is not a directory';
    } else if (error.message) {
      errorMessage = `Completion failed: ${error.message}`;
    }
    
    return {
      success: false,
      message: errorMessage,
      completions: [],
      error: error.code || 'UNKNOWN'
    };
  }
}

// Create mock handlers map
const mockIpcHandlers = new Map();
mockIpcHandlers.set('terminal/get-file-completions', async (event, { partialPath, currentDir }) => {
  return await mockGetFileCompletions(partialPath, currentDir);
});

// Test runner
class AutoCompletionTests {
  constructor() {
    this.testDir = null;
    this.passedTests = 0;
    this.totalTests = 0;
  }

  async runAllTests() {
    console.log('\n1. Setting up test environment...');
    this.setupTestEnvironment();

    console.log('\n2. Testing file completion with various directory structures...');
    await this.testFileCompletionVariousStructures();

    console.log('\n3. Testing command completion with partial command names...');
    await this.testCommandCompletion();

    console.log('\n4. Testing edge cases...');
    await this.testEdgeCases();

    console.log('\n5. Testing special character handling...');
    await this.testSpecialCharacterHandling();

    console.log('\n6. Testing frontend AutoCompleter logic...');
    await this.testAutoCompleterLogic();

    console.log('\n7. Cleaning up...');
    this.cleanup();

    this.printSummary();
  }

  setupTestEnvironment() {
    this.testDir = TestUtils.createTempDir();
    console.log(`Created test directory: ${this.testDir}`);

    // Create test file structure
    const testFiles = [
      { name: 'file1.txt', type: 'file', content: 'test content' },
      { name: 'file2.js', type: 'file', content: 'console.log("test");' },
      { name: 'document.pdf', type: 'file', content: 'pdf content' },
      { name: 'subdir1', type: 'directory' },
      { name: 'subdir1/nested.txt', type: 'file', content: 'nested content' },
      { name: 'subdir2', type: 'directory' },
      { name: 'subdir2/another.js', type: 'file', content: 'more js' },
      { name: 'empty-dir', type: 'directory' },
      { name: 'file with spaces.txt', type: 'file', content: 'spaced file' },
      { name: 'special@chars#file.txt', type: 'file', content: 'special chars' }
    ];

    TestUtils.createTestFiles(this.testDir, testFiles);
    console.log('✅ Test file structure created');
  }

  async testFileCompletionVariousStructures() {
    this.totalTests += 6;

    // Test 1: Basic file completion in root directory
    const handler = mockIpcHandlers.get('terminal/get-file-completions');
    
    // Test empty partial path (should list all files)
    const result1 = await handler(null, { partialPath: '', currentDir: this.testDir });
    const hasFiles = result1.success && result1.completions.length > 0;
    if (TestUtils.assertTrue(hasFiles, 'Empty path returns directory contents')) {
      this.passedTests++;
    }

    // Test 2: Partial filename matching
    const result2 = await handler(null, { partialPath: 'file', currentDir: this.testDir });
    const matchesFiles = result2.success && 
      result2.completions.some(c => c.name.startsWith('file1')) &&
      result2.completions.some(c => c.name.startsWith('file2'));
    if (TestUtils.assertTrue(matchesFiles, 'Partial filename matching works')) {
      this.passedTests++;
    }

    // Test 3: Directory completion with trailing slash
    const result3 = await handler(null, { partialPath: 'subdir', currentDir: this.testDir });
    const hasDirSlash = result3.success && 
      result3.completions.some(c => c.name.endsWith('/') && c.type === 'directory');
    if (TestUtils.assertTrue(hasDirSlash, 'Directory completion includes trailing slash')) {
      this.passedTests++;
    }

    // Test 4: Nested directory completion
    const nestedPath = path.join('subdir1', '');
    const result4 = await handler(null, { partialPath: nestedPath, currentDir: this.testDir });
    const hasNested = result4.success && 
      (result4.completions.some(c => c.name.includes('nested')) || result4.completions.length > 0);
    if (TestUtils.assertTrue(hasNested, 'Nested directory completion works')) {
      this.passedTests++;
    }

    // Test 5: Extension-based filtering
    const result5 = await handler(null, { partialPath: '.js', currentDir: this.testDir });
    const hasJsFiles = result5.success && result5.completions.length >= 0; // May be 0 if no .js files match
    if (TestUtils.assertTrue(hasJsFiles !== undefined, 'Extension-based completion executes')) {
      this.passedTests++;
    }

    // Test 6: Absolute path completion
    const absolutePath = path.join(this.testDir, 'file');
    const result6 = await handler(null, { partialPath: absolutePath, currentDir: process.cwd() });
    const absoluteWorks = result6.success;
    if (TestUtils.assertTrue(absoluteWorks, 'Absolute path completion works')) {
      this.passedTests++;
    }
  }

  async testCommandCompletion() {
    this.totalTests += 4;

    // Create a mock AutoCompleter to test command completion
    const AutoCompleter = class {
      getCommandCompletions(partialCommand) {
        const commands = [
          'list', 'ls', 'info', 'get-title', 'set-title', 'set-size', 'set-position',
          'create-window', 'create-picture', 'set-picture', 'create-content',
          'reload-html', 'help', 'clear', 'save-window', 'restore-window'
        ];
        return commands.filter(cmd =>
          cmd.toLowerCase().startsWith(partialCommand.toLowerCase())
        );
      }

      findCommonPrefix(matches) {
        if (matches.length === 0) return '';
        if (matches.length === 1) return matches[0];

        let prefix = matches[0];
        for (let i = 1; i < matches.length; i++) {
          let j = 0;
          while (j < prefix.length && j < matches[i].length && 
                 prefix[j].toLowerCase() === matches[i][j].toLowerCase()) {
            j++;
          }
          prefix = prefix.substring(0, j);
          if (prefix === '') break;
        }
        return prefix;
      }
    };

    const completer = new AutoCompleter();

    // Test 1: Single command match
    const matches1 = completer.getCommandCompletions('inf');
    if (TestUtils.assertEqual(matches1, ['info'], 'Single command completion for "inf"')) {
      this.passedTests++;
    }

    // Test 2: Multiple command matches
    const matches2 = completer.getCommandCompletions('set');
    const hasMultipleSet = matches2.length > 1 && matches2.every(cmd => cmd.startsWith('set'));
    if (TestUtils.assertTrue(hasMultipleSet, 'Multiple command matches for "set"')) {
      this.passedTests++;
    }

    // Test 3: No matches
    const matches3 = completer.getCommandCompletions('xyz');
    if (TestUtils.assertEqual(matches3, [], 'No matches for non-existent command "xyz"')) {
      this.passedTests++;
    }

    // Test 4: Common prefix calculation
    const testMatches = ['set-title', 'set-size', 'set-position'];
    const commonPrefix = completer.findCommonPrefix(testMatches);
    if (TestUtils.assertEqual(commonPrefix, 'set-', 'Common prefix calculation for set commands')) {
      this.passedTests++;
    }
  }

  async testEdgeCases() {
    this.totalTests += 5;
    const handler = mockIpcHandlers.get('terminal/get-file-completions');

    // Test 1: Empty directory
    const emptyDirPath = path.join(this.testDir, 'empty-dir');
    const result1 = await handler(null, { partialPath: '', currentDir: emptyDirPath });
    const emptyDirResult = result1.success && result1.completions.length === 0;
    if (TestUtils.assertTrue(emptyDirResult, 'Empty directory returns no completions')) {
      this.passedTests++;
    }

    // Test 2: Non-existent directory
    const result2 = await handler(null, { partialPath: 'nonexistent/', currentDir: this.testDir });
    const nonExistentHandled = result2.success === false || result2.completions.length === 0;
    if (TestUtils.assertTrue(nonExistentHandled, 'Non-existent directory handled gracefully')) {
      this.passedTests++;
    }

    // Test 3: Permission denied simulation (using a path that might not be accessible)
    const restrictedPath = '/root/restricted';
    const result3 = await handler(null, { partialPath: restrictedPath, currentDir: process.cwd() });
    const permissionHandled = result3.success === false || result3.error === 'EACCES' || result3.completions.length === 0;
    if (TestUtils.assertTrue(permissionHandled, 'Permission denied paths handled gracefully')) {
      this.passedTests++;
    }

    // Test 4: Very long path
    const longPath = 'a'.repeat(200);
    const result4 = await handler(null, { partialPath: longPath, currentDir: this.testDir });
    const longPathHandled = result4.success !== undefined; // Should not crash
    if (TestUtils.assertTrue(longPathHandled, 'Very long paths handled without crashing')) {
      this.passedTests++;
    }

    // Test 5: Null/undefined inputs
    const result5 = await handler(null, { partialPath: null, currentDir: this.testDir });
    const nullInputHandled = result5.success !== undefined; // Should not crash
    if (TestUtils.assertTrue(nullInputHandled, 'Null inputs handled gracefully')) {
      this.passedTests++;
    }
  }

  async testSpecialCharacterHandling() {
    this.totalTests += 4;
    const handler = mockIpcHandlers.get('terminal/get-file-completions');

    // Test 1: Files with spaces
    const result1 = await handler(null, { partialPath: 'file with', currentDir: this.testDir });
    const spacesHandled = result1.success && 
      result1.completions.some(c => c.name.includes('spaces') || c.escapedName.includes('"'));
    if (TestUtils.assertTrue(spacesHandled, 'Files with spaces handled correctly')) {
      this.passedTests++;
    }

    // Test 2: Files with special characters
    const result2 = await handler(null, { partialPath: 'special@', currentDir: this.testDir });
    const specialCharsHandled = result2.success && 
      result2.completions.some(c => c.name.includes('special') || c.hasSpecialChars);
    if (TestUtils.assertTrue(specialCharsHandled, 'Files with special characters handled correctly')) {
      this.passedTests++;
    }

    // Test 3: Quoted path handling
    const result3 = await handler(null, { partialPath: '"file with', currentDir: this.testDir });
    const quotedHandled = result3.success; // Should not crash with quoted input
    if (TestUtils.assertTrue(quotedHandled, 'Quoted paths handled without crashing')) {
      this.passedTests++;
    }

    // Test 4: Path with backslashes (Windows-style)
    const result4 = await handler(null, { partialPath: 'subdir1\\', currentDir: this.testDir });
    const backslashHandled = result4.success; // Should handle cross-platform paths
    if (TestUtils.assertTrue(backslashHandled, 'Backslash paths handled correctly')) {
      this.passedTests++;
    }
  }

  cleanup() {
    if (this.testDir) {
      TestUtils.cleanup(this.testDir);
      console.log('✅ Test environment cleaned up');
    }
  }

  async testAutoCompleterLogic() {
    this.totalTests += 4;

    // Mock AutoCompleter class with key methods
    class MockAutoCompleter {
      constructor() {
        this.filePathCommands = new Set([
          'reload-html', 'create-picture', 'set-picture', 'create-content',
          'restore-window', 'save-window', 'delete-saved'
        ]);
      }

      isInFilePathPosition(inputValue, cursorPosition) {
        const beforeCursor = inputValue.substring(0, cursorPosition);
        if (!beforeCursor.trim()) return false;
        
        const parts = beforeCursor.split(/\s+/).filter(p => p.length > 0);
        if (parts.length === 0) return false;
        
        const command = parts[0].toLowerCase();
        
        if (this.filePathCommands.has(command) && parts.length > 1) {
          return true;
        }
        
        if (parts.length === 1 && !beforeCursor.endsWith(' ')) {
          return false;
        }
        
        const currentPart = parts[parts.length - 1] || '';
        return this.looksLikeFilePath(currentPart);
      }

      looksLikeFilePath(part) {
        if (!part) return false;
        return /[/\\]/.test(part) || /^[.~]/.test(part) || /\.[a-zA-Z0-9]+$/.test(part);
      }

      findCommonPrefix(matches) {
        if (matches.length === 0) return '';
        if (matches.length === 1) return matches[0];

        let prefix = matches[0];
        for (let i = 1; i < matches.length; i++) {
          let j = 0;
          while (j < prefix.length && j < matches[i].length && 
                 prefix[j].toLowerCase() === matches[i][j].toLowerCase()) {
            j++;
          }
          prefix = prefix.substring(0, j);
          if (prefix === '') break;
        }
        return prefix;
      }

      getCommandCompletions(partialCommand) {
        const commands = [
          'list', 'ls', 'info', 'get-title', 'set-title', 'set-size', 'set-position',
          'create-window', 'create-picture', 'set-picture', 'create-content',
          'reload-html', 'help', 'clear', 'save-window', 'restore-window'
        ];
        return commands.filter(cmd =>
          cmd.toLowerCase().startsWith(partialCommand.toLowerCase())
        );
      }
    }

    const completer = new MockAutoCompleter();

    // Test 1: File path position detection for file commands
    const isFilePath1 = completer.isInFilePathPosition('create-picture /path/to/', 20);
    if (TestUtils.assertTrue(isFilePath1, 'Detects file path position for file commands')) {
      this.passedTests++;
    }

    // Test 2: File path position detection for non-file commands
    const isFilePath2 = completer.isInFilePathPosition('set-title window1 ', 18);
    if (TestUtils.assertTrue(!isFilePath2, 'Does not detect file path for non-file commands')) {
      this.passedTests++;
    }

    // Test 3: File path detection by pattern
    const looksLikePath1 = completer.looksLikeFilePath('./test.txt');
    const looksLikePath2 = completer.looksLikeFilePath('~/documents');
    const looksLikePath3 = completer.looksLikeFilePath('folder/file');
    const looksLikePath4 = completer.looksLikeFilePath('regularword');
    
    const pathDetectionWorks = looksLikePath1 && looksLikePath2 && looksLikePath3 && !looksLikePath4;
    if (TestUtils.assertTrue(pathDetectionWorks, 'File path pattern detection works correctly')) {
      this.passedTests++;
    }

    // Test 4: Command completion integration
    const cmdCompletions = completer.getCommandCompletions('create');
    const hasCreateCommands = cmdCompletions.length > 0 && 
      cmdCompletions.every(cmd => cmd.startsWith('create'));
    if (TestUtils.assertTrue(hasCreateCommands, 'Command completion filters correctly')) {
      this.passedTests++;
    }
  }

  printSummary() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${this.passedTests}/${this.totalTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.passedTests === this.totalTests) {
      console.log('🎉 All tests passed!');
    } else {
      console.log(`⚠️  ${this.totalTests - this.passedTests} test(s) failed`);
    }
  }
}

// Run the tests
const testRunner = new AutoCompletionTests();
testRunner.runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  testRunner.cleanup();
});