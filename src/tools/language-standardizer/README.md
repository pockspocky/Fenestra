# Language Standardizer

A comprehensive tool for detecting, reporting, and verifying non-English content in source code files.

## Features

- **Language Scanner**: Detects Chinese, Japanese, and Korean characters in comments, JSDoc, and string literals
- **Language Reporter**: Generates comprehensive reports in JSON, Markdown, and CSV formats
- **Language Verifier**: Verifies that previously identified issues have been resolved
- **CLI Tool**: Command-line interface for easy integration into workflows

## Installation

The tool is already installed as part of the Fenestra project. Dependencies:
- `commander` - CLI framework
- `glob` - File pattern matching

## Usage

### Command Line Interface

#### Scan Files

Scan all JavaScript files in the src directory:

```bash
npm run language-scan "src/**/*.js"
```

Scan with custom output path and format:

```bash
node src/tools/language-standardizer/cli.js scan "src/**/*.js" -o ./reports/language -f json
```

Scan with custom ignore patterns:

```bash
node src/tools/language-standardizer/cli.js scan "**/*.js" --ignore "node_modules/**" "test/**"
```

Export all formats (JSON, Markdown, CSV):

```bash
node src/tools/language-standardizer/cli.js scan "src/**/*.js" -f all
```

#### Verify Translation

After translating non-English content, verify that all issues are resolved:

```bash
npm run language-verify ./language-report.json
```

Or with custom output:

```bash
node src/tools/language-standardizer/cli.js verify ./language-report.json -o ./verification-report.md
```

#### Generate Report

Generate a report from existing scan results:

```bash
node src/tools/language-standardizer/cli.js report ./language-report.json -f markdown
```

#### Show Examples

Display usage examples:

```bash
node src/tools/language-standardizer/cli.js examples
```

### Programmatic API

```javascript
import { LanguageScanner, LanguageReporter, LanguageVerifier } from './src/tools/language-standardizer/index.js';

// Scan files
const scanner = new LanguageScanner();
const results = await scanner.scanPattern('src/**/*.js');

// Generate report
const reporter = new LanguageReporter();
const report = reporter.generateReport(results);

// Export report
await reporter.exportJSON(report, './language-report.json');
await reporter.exportMarkdown(report, './language-report.md');
await reporter.exportCSV(report, './language-report.csv');

// Verify translation
const verifier = new LanguageVerifier();
const originalReport = await verifier.loadOriginalReport('./language-report.json');
const verificationResult = await verifier.verify(originalReport);

console.log(`Verification ${verificationResult.passed ? 'passed' : 'failed'}`);
console.log(`Resolved: ${verificationResult.resolvedIssues}`);
console.log(`Remaining: ${verificationResult.remainingIssues.length}`);
```

## Report Formats

### JSON Report

Contains complete scan results with metadata:

```json
{
  "timestamp": "2026-01-13T...",
  "totalFiles": 10,
  "filesWithIssues": 5,
  "totalIssues": 42,
  "results": [...],
  "summary": {
    "byType": { "comment": 30, "string": 12 },
    "byLanguage": { "chinese": 35, "japanese": 7 },
    "byFile": { "file1.js": 20, "file2.js": 22 }
  }
}
```

### Markdown Report

Human-readable report with:
- Summary statistics
- Issues grouped by type, language, and file
- Detailed results with context
- Error information (if any)

### CSV Report

Spreadsheet-compatible format with columns:
- File Path
- Line Number
- Column Number
- Type (comment, string, jsdoc)
- Language (chinese, japanese, korean)
- Content

## Detected Languages

The scanner detects the following Unicode ranges:

- **Chinese**: U+4E00 to U+9FFF (CJK Unified Ideographs)
- **Japanese**: U+3040 to U+309F (Hiragana), U+30A0 to U+30FF (Katakana)
- **Korean**: U+AC00 to U+D7AF (Hangul Syllables)

## Integration

### Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
node src/tools/language-standardizer/cli.js scan "src/**/*.js" -o ./language-report -f json
```

### CI/CD Pipeline

Add to GitHub Actions workflow:

```yaml
- name: Language Validation
  run: |
    node src/tools/language-standardizer/cli.js scan "src/**/*.js"
```

## Requirements Validation

This tool validates the following requirements:

- **1.1**: Identifies and labels all non-English content
- **1.2**: Provides file paths, line numbers, and context
- **1.3**: Creates comprehensive list of locations requiring translation
- **1.4**: Verifies previously identified locations now contain English
- **1.5**: Confirms no mixed-language content remains
- **2.1**: Identifies non-English log output
- **2.2**: Provides file paths and line numbers for log statements
- **2.3**: Verifies all log messages are in English
- **2.5**: Verifies no non-English log output exists

## Testing

Run the test suite:

```bash
node test-language-standardizer.js
```

This will:
1. Test scanner detection of Chinese characters
2. Test reporter generation
3. Test export to different formats
4. Test verifier functionality
5. Scan actual project files

## Output

All reports are saved to the specified output directory (default: `./language-report`).

Example output structure:
```
./language-report.json      # JSON format
./language-report.md        # Markdown format
./language-report.csv       # CSV format
./verification-report.md    # Verification results
```

## Error Handling

The tool handles errors gracefully:

- **File Access Errors**: Logs error and continues with other files
- **Encoding Errors**: Attempts to detect and convert encoding
- **Report Generation Errors**: Falls back to console output
- **Verification Errors**: Provides detailed error messages

## Exit Codes

- `0`: Success (no issues found or verification passed)
- `1`: Failure (issues found or verification failed)

This allows integration into CI/CD pipelines that fail on quality issues.
