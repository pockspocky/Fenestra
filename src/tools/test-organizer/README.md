# Test Organizer

Tools for analyzing, consolidating, and reorganizing test files in the Fenestra project.

## Overview

The Test Organizer provides automated tools to:
- Scan and catalog all test files
- Identify duplicate test coverage
- Generate consolidation plans
- Migrate tests to organized directory structure
- Update import statements automatically
- Verify tests still run after migration

## Components

### TestAnalyzer

Scans all test files and extracts metadata including:
- Component being tested
- Test type (unit, integration, property-based)
- Test coverage (what functionality is tested)
- Dependencies (imports and modules used)
- Feature and property information

### TestConsolidator

Analyzes duplicate test groups and generates consolidation plans:
- Identifies tests with overlapping coverage
- Recommends merge, review, or keep-separate actions
- Generates merge instructions
- Exports plans in JSON and Markdown formats

### TestMigrator

Implements file move operations to reorganize tests:
- Creates organized directory structure
- Moves files to appropriate locations
- Updates import statements automatically
- Creates backups before migration
- Supports dry-run mode
- Provides rollback capability

## Target Directory Structure

```
tests/
├── unit/                    # Unit tests for individual components
│   ├── core/
│   ├── systems/
│   ├── handlers/
│   ├── utils/
│   └── security/
├── integration/             # Integration tests
│   ├── email-system/
│   ├── door-key-system/
│   └── window-management/
├── property-based/          # Property-based tests
│   ├── security/
│   ├── state-management/
│   └── data-integrity/
├── fixtures/                # Test data and fixtures
└── helpers/                 # Test utilities and helpers
```

## Naming Convention

Test files follow the pattern: `{component}.{type}.test.js`

Examples:
- `gameLogic.unit.test.js`
- `emailSystem.integration.test.js`
- `pathSecurity.property.test.js`

## CLI Usage

### Analyze Tests

Scan and catalog all test files:

```bash
node src/tools/test-organizer/cli.js analyze
```

Options:
- `-p, --pattern <pattern>` - Test file pattern (default: `test-*.js`)
- `-o, --output <path>` - Output file path (default: `test-catalog.json`)
- `-f, --format <format>` - Output format: json or markdown (default: `json`)

Example:
```bash
node src/tools/test-organizer/cli.js analyze -f markdown -o test-catalog.md
```

### Generate Consolidation Plan

Analyze duplicates and generate consolidation plan:

```bash
node src/tools/test-organizer/cli.js consolidate
```

Options:
- `-i, --input <path>` - Input catalog file (default: `test-catalog.json`)
- `-o, --output <path>` - Output plan file (default: `consolidation-plan.json`)
- `-f, --format <format>` - Output format: json or markdown (default: `json`)

Example:
```bash
node src/tools/test-organizer/cli.js consolidate -f markdown -o consolidation-plan.md
```

### Migrate Tests

Move tests to organized directory structure:

```bash
node src/tools/test-organizer/cli.js migrate
```

Options:
- `-i, --input <path>` - Input catalog file (default: `test-catalog.json`)
- `-d, --tests-dir <path>` - Tests directory (default: `tests`)
- `--dry-run` - Preview changes without executing
- `--no-backup` - Skip backup creation

Example (dry run):
```bash
node src/tools/test-organizer/cli.js migrate --dry-run
```

Example (actual migration):
```bash
node src/tools/test-organizer/cli.js migrate
```

### Verify Tests

Verify tests still run after migration:

```bash
node src/tools/test-organizer/cli.js verify
```

Options:
- `-d, --tests-dir <path>` - Tests directory (default: `tests`)

### Rollback Migration

Rollback migration using backup:

```bash
node src/tools/test-organizer/cli.js rollback <backup-path>
```

Example:
```bash
node src/tools/test-organizer/cli.js rollback test-backup-2026-01-13T12-00-00-000Z
```

## Programmatic Usage

### Analyze Tests

```javascript
import { TestAnalyzer } from './src/tools/test-organizer/index.js';

const analyzer = new TestAnalyzer({
  testPattern: 'test-*.js',
  excludePatterns: ['node_modules/**', 'tests/**']
});

const catalog = await analyzer.analyzeTests();
console.log(`Found ${catalog.totalFiles} test files`);
console.log(`Total tests: ${catalog.summary.totalTests}`);
```

### Generate Consolidation Plan

```javascript
import { TestConsolidator } from './src/tools/test-organizer/index.js';

const consolidator = new TestConsolidator();
const plan = await consolidator.consolidate(catalog);

console.log(`Files to merge: ${plan.summary.filesToMerge}`);
console.log(`Estimated reduction: ${plan.summary.estimatedReduction}`);

// Export plan
await consolidator.exportMarkdown(plan, 'consolidation-plan.md');
```

### Migrate Tests

```javascript
import { TestMigrator } from './src/tools/test-organizer/index.js';

const migrator = new TestMigrator({
  testsDir: 'tests',
  dryRun: false,
  backup: true
});

const result = await migrator.migrate(catalog, {});

console.log(`Moved: ${result.moved.length} files`);
console.log(`Failed: ${result.failed.length} files`);
console.log(`Backup: ${result.backupPath}`);
```

## Workflow

1. **Analyze**: Scan all test files and generate catalog
   ```bash
   node src/tools/test-organizer/cli.js analyze -f markdown
   ```

2. **Review**: Review the catalog to understand current test organization

3. **Consolidate**: Generate consolidation plan for duplicates
   ```bash
   node src/tools/test-organizer/cli.js consolidate -f markdown
   ```

4. **Review Plan**: Review consolidation plan and decide on merges

5. **Dry Run**: Preview migration without making changes
   ```bash
   node src/tools/test-organizer/cli.js migrate --dry-run
   ```

6. **Migrate**: Execute migration with backup
   ```bash
   node src/tools/test-organizer/cli.js migrate
   ```

7. **Verify**: Run tests to ensure everything still works
   ```bash
   npm test
   ```

8. **Rollback** (if needed): Restore from backup
   ```bash
   node src/tools/test-organizer/cli.js rollback <backup-path>
   ```

## Features

### Automatic Import Updates

The migrator automatically updates import statements when moving files:

Before (in root):
```javascript
import { gameLogic } from './src/core/systems/gameLogic.js';
```

After (in tests/unit/systems/):
```javascript
import { gameLogic } from '../../../src/core/systems/gameLogic.js';
```

### Backup and Rollback

Before migration, a timestamped backup is created:
```
test-backup-2026-01-13T12-00-00-000Z/
├── test-door-state-management.js
├── test-email-callbacks-integration.js
└── ...
```

If something goes wrong, rollback using:
```bash
node src/tools/test-organizer/cli.js rollback test-backup-2026-01-13T12-00-00-000Z
```

### Dry Run Mode

Preview changes without executing:
```bash
node src/tools/test-organizer/cli.js migrate --dry-run
```

Output shows what would happen:
```
[DRY RUN] Would create directory: tests/unit/systems
[DRY RUN] Would move: test-door-state-management.js -> tests/property-based/state-management/door-state-management.property.test.js
[DRY RUN] Would update imports in: tests/property-based/state-management/door-state-management.property.test.js
```

## Package.json Integration

After migration, package.json is updated with new test scripts:

```json
{
  "scripts": {
    "test": "npm run test:all",
    "test:unit": "node tests/unit/**/*.test.js",
    "test:integration": "node tests/integration/**/*.test.js",
    "test:property": "node tests/property-based/**/*.test.js",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:property"
  }
}
```

## Error Handling

The tool handles various error scenarios:

- **File access errors**: Logs error and continues with other files
- **Migration failures**: Maintains list of failed moves for manual intervention
- **Import update failures**: Preserves original imports and reports failures
- **Verification failures**: Provides detailed error report

## Requirements

- Node.js >= 16.0.0
- Dependencies:
  - `glob` - File pattern matching
  - `commander` - CLI framework

## Related Tools

- **Language Standardizer**: Converts mixed-language content to English
- **Callback Simplifier**: Refactors callback system architecture
- **Directory Restructurer**: Reorganizes project directory structure
- **Quality Validator**: Enforces code quality standards
