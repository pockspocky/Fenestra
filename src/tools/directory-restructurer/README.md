# Directory Restructurer

Automated tool for reorganizing the Fenestra codebase into a logical directory structure with proper file migration, import updates, and validation.

## Features

- **Directory Structure Design**: Analyzes current structure and creates comprehensive file mappings
- **Safe File Migration**: Moves files with integrity verification and rollback capability
- **Import Updates**: Automatically updates all import statements to reflect new file locations
- **Validation**: Verifies all imports resolve correctly after restructuring
- **Cleanup**: Removes redundant files and empty directories

## Target Directory Structure

```
src/
├── core/           # Core application configuration
├── systems/        # Game systems (door-key, email, lens, etc.)
├── events/         # Event system (EventEmitter, system/domain events)
├── handlers/       # Event handlers (IPC, hotkeys, start menu)
├── security/       # Security components (validation, sandboxing)
├── storage/        # Data persistence (email, window, game state)
├── utils/          # Utility functions
└── workers/        # Worker thread management
```

## Installation

The tool is already part of the Fenestra project. No additional installation needed.

## Usage

### Command Line Interface

```bash
# Create directory structure design
node src/tools/directory-restructurer/cli.js design

# Migrate files (dry run)
node src/tools/directory-restructurer/cli.js migrate

# Migrate files (execute)
node src/tools/directory-restructurer/cli.js migrate --execute

# Update imports (dry run)
node src/tools/directory-restructurer/cli.js update-imports

# Update imports (execute)
node src/tools/directory-restructurer/cli.js update-imports --execute

# Validate import resolution
node src/tools/directory-restructurer/cli.js validate

# Execute complete workflow (dry run)
node src/tools/directory-restructurer/cli.js execute

# Execute complete workflow (actual)
node src/tools/directory-restructurer/cli.js execute --execute

# Cleanup redundant files
node src/tools/directory-restructurer/cli.js cleanup --execute
```

### Programmatic Usage

```javascript
import { 
  DirectoryStructureDesigner, 
  FileMigrator, 
  ImportUpdater 
} from './src/tools/directory-restructurer/index.js';

// Create design
const designer = new DirectoryStructureDesigner();
const design = await designer.design();

// Migrate files
const migrator = new FileMigrator({ dryRun: false });
const results = await migrator.migrate(design.mapping.mappings);

// Update imports
const updater = new ImportUpdater({ dryRun: false });
await updater.updateAllImports(design.mapping.mappings);

// Validate
const validation = await updater.validateImports();
```

## Workflow

### 1. Design Phase

Creates a comprehensive mapping of current files to target locations:

```bash
node src/tools/directory-restructurer/cli.js design
```

**Output:**
- `directory-structure-design.json` - Machine-readable design data
- `directory-structure-report.md` - Human-readable report

**What it does:**
- Scans current directory structure
- Maps files to target locations based on their purpose
- Validates mapping completeness
- Identifies unmapped files
- Detects potential issues (duplicates, circular mappings)

### 2. Migration Phase

Safely moves files to their new locations:

```bash
# Dry run first (recommended)
node src/tools/directory-restructurer/cli.js migrate

# Execute actual migration
node src/tools/directory-restructurer/cli.js migrate --execute
```

**What it does:**
- Creates backup of each file before moving
- Creates target directories as needed
- Verifies file integrity using SHA-256 hashes
- Rolls back on failure
- Logs all operations

### 3. Import Update Phase

Updates all import statements to reflect new file locations:

```bash
# Dry run first (recommended)
node src/tools/directory-restructurer/cli.js update-imports

# Execute actual updates
node src/tools/directory-restructurer/cli.js update-imports --execute
```

**What it does:**
- Extracts all import statements (ES6, dynamic, require)
- Calculates new relative paths
- Updates import paths in all files
- Handles both relative and absolute imports
- Logs all changes

### 4. Validation Phase

Verifies all imports resolve correctly:

```bash
node src/tools/directory-restructurer/cli.js validate
```

**What it does:**
- Checks every import statement
- Verifies imported files exist
- Reports broken imports with file and line number
- Ensures application will run after restructuring

### 5. Cleanup Phase

Removes redundant files and directories:

```bash
node src/tools/directory-restructurer/cli.js cleanup --execute
```

**What it does:**
- Removes all .DS_Store files
- Removes empty directories
- Removes migration-backup directory (if present)

## Complete Workflow Example

```bash
# 1. Create design and review report
node src/tools/directory-restructurer/cli.js design
cat directory-structure-report.md

# 2. Test migration (dry run)
node src/tools/directory-restructurer/cli.js migrate

# 3. Execute migration
node src/tools/directory-restructurer/cli.js migrate --execute

# 4. Test import updates (dry run)
node src/tools/directory-restructurer/cli.js update-imports

# 5. Execute import updates
node src/tools/directory-restructurer/cli.js update-imports --execute

# 6. Validate everything works
node src/tools/directory-restructurer/cli.js validate

# 7. Test application
npm start

# 8. Run tests
npm test

# 9. Cleanup
node src/tools/directory-restructurer/cli.js cleanup --execute
```

Or use the all-in-one command:

```bash
# Dry run complete workflow
node src/tools/directory-restructurer/cli.js execute

# Execute complete workflow
node src/tools/directory-restructurer/cli.js execute --execute
```

## Safety Features

### Dry Run Mode

All commands default to dry-run mode, showing what would happen without making changes:

```bash
# These are dry runs by default
node src/tools/directory-restructurer/cli.js migrate
node src/tools/directory-restructurer/cli.js update-imports
node src/tools/directory-restructurer/cli.js execute
```

Use `--execute` to perform actual operations:

```bash
node src/tools/directory-restructurer/cli.js migrate --execute
```

### Backup System

Before moving any file, a backup is created in `.migration-backup/`:

```
.migration-backup/
└── src/
    └── core/
        └── systems/
            └── gameLogic.js  # Backup of original file
```

### Rollback on Failure

If migration fails, all successful moves are automatically rolled back:

```
Migration stopped due to error. Rolling back...
✓ Rolled back: src/systems/gameLogic.js → src/core/systems/gameLogic.js
Rollback complete
```

### Integrity Verification

Every moved file is verified using SHA-256 hashes:

```
✓ Moved: src/core/systems/gameLogic.js → src/systems/gameLogic.js
✓ Verified: src/systems/gameLogic.js (hash: abc123...)
```

## Output Files

### Design Phase
- `directory-structure-design.json` - Complete design data
- `directory-structure-report.md` - Human-readable report

### Migration Phase
- `migration-log.json` - Detailed migration log
- `.migration-backup/` - Backup directory

### Import Update Phase
- `import-update-log.json` - Detailed update log

## Error Handling

The tool handles various error scenarios:

- **File not found**: Skips missing files, continues with others
- **Permission denied**: Reports error, continues with other files
- **Duplicate targets**: Detected during validation, prevents execution
- **Circular mappings**: Detected during validation, prevents execution
- **Broken imports**: Reported during validation with file and line number
- **Migration failure**: Automatic rollback of successful operations

## Troubleshooting

### Validation Fails

If validation fails, review the report:

```bash
cat directory-structure-report.md
```

Common issues:
- Files not in target structure (may need manual handling)
- Duplicate target paths (fix mapping logic)
- Circular mappings (fix mapping logic)

### Import Resolution Fails

If imports don't resolve after migration:

```bash
node src/tools/directory-restructurer/cli.js validate
```

This will show exactly which imports are broken and where.

### Application Won't Start

1. Check validation passed:
   ```bash
   node src/tools/directory-restructurer/cli.js validate
   ```

2. Review migration log:
   ```bash
   cat migration-log.json
   ```

3. Restore from backup if needed:
   ```bash
   cp -r .migration-backup/src/* src/
   ```

## API Reference

### DirectoryStructureDesigner

```javascript
const designer = new DirectoryStructureDesigner(options);
```

**Options:**
- `rootDir` - Root directory (default: `process.cwd()`)
- `dryRun` - Dry run mode (default: `true`)

**Methods:**
- `scanCurrentStructure()` - Scan current directory structure
- `createFileMapping()` - Create file mappings
- `validateMapping(mapping)` - Validate mapping completeness
- `design()` - Complete design workflow
- `exportDesign(design, path)` - Export design to file

### FileMigrator

```javascript
const migrator = new FileMigrator(options);
```

**Options:**
- `rootDir` - Root directory (default: `process.cwd()`)
- `dryRun` - Dry run mode (default: `true`)
- `backupDir` - Backup directory (default: `.migration-backup`)

**Methods:**
- `moveFile(mapping)` - Move single file
- `migrate(mappings)` - Migrate multiple files
- `rollback(migrations)` - Rollback migrations
- `verifyMigration(results)` - Verify migration integrity
- `exportLog(path)` - Export migration log

### ImportUpdater

```javascript
const updater = new ImportUpdater(options);
```

**Options:**
- `rootDir` - Root directory (default: `process.cwd()`)
- `dryRun` - Dry run mode (default: `true`)

**Methods:**
- `extractImports(content)` - Extract import statements
- `updateFileImports(file, mapping)` - Update imports in file
- `updateAllImports(mappings)` - Update all imports
- `validateImports()` - Validate import resolution
- `exportLog(path)` - Export update log

## Contributing

When modifying the directory restructurer:

1. Update target structure in `DirectoryStructureDesigner.js`
2. Test with dry run first
3. Verify validation passes
4. Test application after restructuring
5. Update documentation

## License

MIT
