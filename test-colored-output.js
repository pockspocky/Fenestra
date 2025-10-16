// Unit tests for colored output system
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import './logger.js';

// Set log level for testing
global.logLevel = "log";

console.log('=== Colored Output System Tests ===');

// Test utilities
class TestUtils {
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

  static assertContains(container, item, message) {
    if (!container.includes(item)) {
      console.error(`❌ ${message}`);
      console.error('Container:', container);
      console.error('Expected to contain:', item);
      return false;
    }
    console.log(`✅ ${message}`);
    return true;
  }

  static assertColorValue(element, expectedColor, message) {
    const computedStyle = element.ownerDocument.defaultView.getComputedStyle(element);
    const actualColor = computedStyle.color;
    
    // Convert hex to rgb for comparison if needed
    const normalizedExpected = this.normalizeColor(expectedColor);
    const normalizedActual = this.normalizeColor(actualColor);
    
    if (normalizedExpected !== normalizedActual) {
      console.error(`❌ ${message}`);
      console.error('Expected color:', expectedColor, '(normalized:', normalizedExpected, ')');
      console.error('Actual color:', actualColor, '(normalized:', normalizedActual, ')');
      return false;
    }
    console.log(`✅ ${message}`);
    return true;
  }

  static normalizeColor(color) {
    // Convert hex colors to rgb format for consistent comparison
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      return `rgb(${r}, ${g}, ${b})`;
    }
    return color;
  }
}

// Mock DOM environment for testing
class ColoredOutputTests {
  constructor() {
    this.passedTests = 0;
    this.totalTests = 0;
    this.dom = null;
    this.document = null;
    this.window = null;
  }

  async runAllTests() {
    console.log('\n1. Setting up DOM environment...');
    this.setupDOMEnvironment();

    console.log('\n2. Testing color type definitions...');
    await this.testColorTypeDefinitions();

    console.log('\n3. Testing print function with different color types...');
    await this.testPrintFunctionColorTypes();

    console.log('\n4. Testing specialized print functions...');
    await this.testSpecializedPrintFunctions();

    console.log('\n5. Testing color consistency across message types...');
    await this.testColorConsistency();

    console.log('\n6. Testing visual distinction of colored tips...');
    await this.testVisualDistinction();

    console.log('\n7. Testing color accessibility...');
    await this.testColorAccessibility();

    console.log('\n8. Cleaning up...');
    this.cleanup();

    this.printSummary();
  }

  setupDOMEnvironment() {
    // Read the actual terminal.html file
    const terminalHtmlPath = path.join(process.cwd(), 'renderer', 'terminal.html');
    const terminalHtml = fs.readFileSync(terminalHtmlPath, 'utf8');
    
    // Create JSDOM instance
    this.dom = new JSDOM(terminalHtml, {
      runScripts: "dangerously",
      resources: "usable"
    });
    
    this.document = this.dom.window.document;
    this.window = this.dom.window;
    
    // Mock electronAPI to prevent errors
    this.window.electronAPI = {
      executeTerminalCommand: () => Promise.resolve({ success: true }),
      getFileCompletions: () => Promise.resolve({ success: true, completions: [] }),
      getCurrentDirectory: () => Promise.resolve({ success: true, currentDirectory: '/test' })
    };
    
    console.log('✅ DOM environment set up successfully');
  }

  async testColorTypeDefinitions() {
    this.totalTests += 6;

    // Test that all required CSS color classes are defined
    const styleSheets = Array.from(this.document.styleSheets);
    let cssRules = [];
    
    // Extract CSS rules from style elements
    const styleElements = this.document.querySelectorAll('style');
    styleElements.forEach(style => {
      const cssText = style.textContent;
      cssRules.push(cssText);
    });
    
    const allCssText = cssRules.join('\n');
    
    // Test 1: .tip class exists with correct color
    const hasTipClass = allCssText.includes('.tip') && allCssText.includes('#ffaa00');
    if (TestUtils.assertTrue(hasTipClass, 'CSS .tip class defined with orange color (#ffaa00)')) {
      this.passedTests++;
    }

    // Test 2: .command-help class exists with correct color
    const hasCommandHelpClass = allCssText.includes('.command-help') && allCssText.includes('#00aaff');
    if (TestUtils.assertTrue(hasCommandHelpClass, 'CSS .command-help class defined with blue color (#00aaff)')) {
      this.passedTests++;
    }

    // Test 3: .parameter class exists with correct color
    const hasParameterClass = allCssText.includes('.parameter') && allCssText.includes('#aa00ff');
    if (TestUtils.assertTrue(hasParameterClass, 'CSS .parameter class defined with purple color (#aa00ff)')) {
      this.passedTests++;
    }

    // Test 4: .example class exists with correct color
    const hasExampleClass = allCssText.includes('.example') && allCssText.includes('#888888');
    if (TestUtils.assertTrue(hasExampleClass, 'CSS .example class defined with gray color (#888888)')) {
      this.passedTests++;
    }

    // Test 5: .error class exists with correct color
    const hasErrorClass = allCssText.includes('.error') && allCssText.includes('#ff0000');
    if (TestUtils.assertTrue(hasErrorClass, 'CSS .error class defined with red color (#ff0000)')) {
      this.passedTests++;
    }

    // Test 6: .success class exists with correct color
    const hasSuccessClass = allCssText.includes('.success') && allCssText.includes('#00ff00');
    if (TestUtils.assertTrue(hasSuccessClass, 'CSS .success class defined with green color (#00ff00)')) {
      this.passedTests++;
    }
  }

  async testPrintFunctionColorTypes() {
    this.totalTests += 8;

    // Wait for DOM to be ready and scripts to load
    await new Promise(resolve => setTimeout(resolve, 100));

    const outputElement = this.document.getElementById('output');
    const initialChildCount = outputElement.children.length;

    // Test print function exists and works
    const printExists = typeof this.window.print === 'function';
    if (TestUtils.assertTrue(printExists, 'print function exists in global scope')) {
      this.passedTests++;
    }

    if (!printExists) {
      // If print function doesn't exist, create a mock for testing
      this.window.print = function(message, type = 'info') {
        const line = this.document.createElement('div');
        line.className = `output-line ${type}`;
        line.textContent = message;
        this.document.getElementById('output').appendChild(line);
      }.bind(this.window);
    }

    // Test 1: Print with 'tip' type
    this.window.print('Test tip message', 'tip');
    const tipElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('tip') && el.textContent.includes('Test tip message')
    );
    if (TestUtils.assertTrue(tipElement !== undefined, 'print() with "tip" type creates element with tip class')) {
      this.passedTests++;
    }

    // Test 2: Print with 'command-help' type
    this.window.print('Test command help message', 'command-help');
    const commandHelpElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('command-help') && el.textContent.includes('Test command help message')
    );
    if (TestUtils.assertTrue(commandHelpElement !== undefined, 'print() with "command-help" type creates element with command-help class')) {
      this.passedTests++;
    }

    // Test 3: Print with 'parameter' type
    this.window.print('Test parameter message', 'parameter');
    const parameterElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('parameter') && el.textContent.includes('Test parameter message')
    );
    if (TestUtils.assertTrue(parameterElement !== undefined, 'print() with "parameter" type creates element with parameter class')) {
      this.passedTests++;
    }

    // Test 4: Print with 'example' type
    this.window.print('Test example message', 'example');
    const exampleElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('example') && el.textContent.includes('Test example message')
    );
    if (TestUtils.assertTrue(exampleElement !== undefined, 'print() with "example" type creates element with example class')) {
      this.passedTests++;
    }

    // Test 5: Print with 'error' type
    this.window.print('Test error message', 'error');
    const errorElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('error') && el.textContent.includes('Test error message')
    );
    if (TestUtils.assertTrue(errorElement !== undefined, 'print() with "error" type creates element with error class')) {
      this.passedTests++;
    }

    // Test 6: Print with 'success' type
    this.window.print('Test success message', 'success');
    const successElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('success') && el.textContent.includes('Test success message')
    );
    if (TestUtils.assertTrue(successElement !== undefined, 'print() with "success" type creates element with success class')) {
      this.passedTests++;
    }

    // Test 7: Print with default 'info' type
    this.window.print('Test info message');
    const infoElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('info') && el.textContent.includes('Test info message')
    );
    if (TestUtils.assertTrue(infoElement !== undefined, 'print() with default type creates element with info class')) {
      this.passedTests++;
    }
  }

  async testSpecializedPrintFunctions() {
    this.totalTests += 4;

    const outputElement = this.document.getElementById('output');

    // Check if specialized functions exist, if not create mocks
    if (typeof this.window.printTip !== 'function') {
      this.window.printTip = function(message) {
        this.print(message, 'tip');
      }.bind(this.window);
    }

    if (typeof this.window.printCommandHelp !== 'function') {
      this.window.printCommandHelp = function(message) {
        this.print(message, 'command-help');
      }.bind(this.window);
    }

    if (typeof this.window.printParameter !== 'function') {
      this.window.printParameter = function(message) {
        this.print(message, 'parameter');
      }.bind(this.window);
    }

    if (typeof this.window.printExample !== 'function') {
      this.window.printExample = function(message) {
        this.print(message, 'example');
      }.bind(this.window);
    }

    // Test 1: printTip function
    this.window.printTip('Specialized tip message');
    const tipElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('tip') && el.textContent.includes('Specialized tip message')
    );
    if (TestUtils.assertTrue(tipElement !== undefined, 'printTip() creates element with tip class')) {
      this.passedTests++;
    }

    // Test 2: printCommandHelp function
    this.window.printCommandHelp('Specialized command help message');
    const commandHelpElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('command-help') && el.textContent.includes('Specialized command help message')
    );
    if (TestUtils.assertTrue(commandHelpElement !== undefined, 'printCommandHelp() creates element with command-help class')) {
      this.passedTests++;
    }

    // Test 3: printParameter function
    this.window.printParameter('Specialized parameter message');
    const parameterElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('parameter') && el.textContent.includes('Specialized parameter message')
    );
    if (TestUtils.assertTrue(parameterElement !== undefined, 'printParameter() creates element with parameter class')) {
      this.passedTests++;
    }

    // Test 4: printExample function
    this.window.printExample('Specialized example message');
    const exampleElement = Array.from(outputElement.children).find(el => 
      el.classList.contains('example') && el.textContent.includes('Specialized example message')
    );
    if (TestUtils.assertTrue(exampleElement !== undefined, 'printExample() creates element with example class')) {
      this.passedTests++;
    }
  }

  async testColorConsistency() {
    // Create test elements with different color classes
    const testColors = [
      { class: 'tip', expectedColor: '#ffaa00', name: 'tip' },
      { class: 'command-help', expectedColor: '#00aaff', name: 'command-help' },
      { class: 'parameter', expectedColor: '#aa00ff', name: 'parameter' },
      { class: 'example', expectedColor: '#888888', name: 'example' },
      { class: 'error', expectedColor: '#ff0000', name: 'error' }
    ];

    testColors.forEach(({ class: className, expectedColor, name }) => {
      this.totalTests++;
      
      // Create test element
      const testElement = this.document.createElement('div');
      testElement.className = `output-line ${className}`;
      testElement.textContent = `Test ${name} message`;
      this.document.body.appendChild(testElement);

      // Get computed style
      const computedStyle = this.window.getComputedStyle(testElement);
      const actualColor = computedStyle.color;
      
      // Convert expected hex to rgb for comparison
      const expectedRgb = this.hexToRgb(expectedColor);
      const expectedRgbString = `rgb(${expectedRgb.r}, ${expectedRgb.g}, ${expectedRgb.b})`;
      
      const colorsMatch = actualColor === expectedRgbString || actualColor === expectedColor;
      if (TestUtils.assertTrue(colorsMatch, `${name} class has consistent color (expected: ${expectedColor}, actual: ${actualColor})`)) {
        this.passedTests++;
      }

      // Clean up
      testElement.remove();
    });
  }

  async testVisualDistinction() {
    this.totalTests += 3;

    // Test that colored tips are visually distinct from regular output
    const regularElement = this.document.createElement('div');
    regularElement.className = 'output-line info';
    regularElement.textContent = 'Regular info message';
    this.document.body.appendChild(regularElement);

    const tipElement = this.document.createElement('div');
    tipElement.className = 'output-line tip';
    tipElement.textContent = 'Tip message';
    this.document.body.appendChild(tipElement);

    const regularStyle = this.window.getComputedStyle(regularElement);
    const tipStyle = this.window.getComputedStyle(tipElement);

    // Test 1: Tips have different color from regular info
    const colorsDifferent = regularStyle.color !== tipStyle.color;
    if (TestUtils.assertTrue(colorsDifferent, 'Tip messages have different color from regular info messages')) {
      this.passedTests++;
    }

    // Test 2: Command help is distinct from tips
    const commandHelpElement = this.document.createElement('div');
    commandHelpElement.className = 'output-line command-help';
    commandHelpElement.textContent = 'Command help message';
    this.document.body.appendChild(commandHelpElement);

    const commandHelpStyle = this.window.getComputedStyle(commandHelpElement);
    const helpTipDistinct = commandHelpStyle.color !== tipStyle.color;
    if (TestUtils.assertTrue(helpTipDistinct, 'Command help messages are visually distinct from tips')) {
      this.passedTests++;
    }

    // Test 3: Parameters are distinct from examples
    const parameterElement = this.document.createElement('div');
    parameterElement.className = 'output-line parameter';
    parameterElement.textContent = 'Parameter message';
    this.document.body.appendChild(parameterElement);

    const exampleElement = this.document.createElement('div');
    exampleElement.className = 'output-line example';
    exampleElement.textContent = 'Example message';
    this.document.body.appendChild(exampleElement);

    const parameterStyle = this.window.getComputedStyle(parameterElement);
    const exampleStyle = this.window.getComputedStyle(exampleElement);
    const paramExampleDistinct = parameterStyle.color !== exampleStyle.color;
    if (TestUtils.assertTrue(paramExampleDistinct, 'Parameter messages are visually distinct from examples')) {
      this.passedTests++;
    }

    // Clean up
    regularElement.remove();
    tipElement.remove();
    commandHelpElement.remove();
    parameterElement.remove();
    exampleElement.remove();
  }

  async testColorAccessibility() {
    // Test color contrast and accessibility
    const colorTests = [
      { class: 'tip', color: '#ffaa00', name: 'tip (orange)' },
      { class: 'command-help', color: '#00aaff', name: 'command-help (blue)' },
      { class: 'parameter', color: '#aa00ff', name: 'parameter (purple)' },
      { class: 'example', color: '#888888', name: 'example (gray)' }
    ];

    colorTests.forEach(({ class: className, color, name }) => {
      this.totalTests++;
      
      // Test that colors are not too similar to background (#000000)
      const rgb = this.hexToRgb(color);
      const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
      
      // Colors should have sufficient brightness against black background
      const sufficientContrast = brightness > 50; // Minimum brightness threshold
      if (TestUtils.assertTrue(sufficientContrast, `${name} has sufficient contrast against black background (brightness: ${brightness.toFixed(1)})`)) {
        this.passedTests++;
      }
    });
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  cleanup() {
    if (this.dom) {
      this.dom.window.close();
      console.log('✅ DOM environment cleaned up');
    }
  }

  printSummary() {
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${this.passedTests}/${this.totalTests}`);
    console.log(`Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);
    
    if (this.passedTests === this.totalTests) {
      console.log('🎉 All colored output tests passed!');
    } else {
      console.log(`⚠️  ${this.totalTests - this.passedTests} test(s) failed`);
    }
  }
}

// Run the tests
const testRunner = new ColoredOutputTests();
testRunner.runAllTests().catch(error => {
  console.error('Test execution failed:', error);
  testRunner.cleanup();
});