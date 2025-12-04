# Windows File System Handling Guide

This guide explains the Windows-specific file system utilities provided by the `windowsFileSystem` module.

## Overview

The `windowsFileSystem` module provides cross-platform file system operations with special handling for Windows-specific features:

- **Long path handling** (MAX_PATH limitation)
- **Case-insensitive file existence checking**
- **Windows ACL permission checking**
- **Symlink and junction resolution**
- **Hidden and system file handling**

## Module Location

```javascript
import {
  checkFileExistsCaseInsensitive,
  handleLongPath,
  checkWindowsPermissions,
  resolveSymlink,
  readDirectoryWithHidden,
  createDirectorySafe,
  checkPathLength,
  getFileInfo
} from './src/core/utils/windowsFileSystem.js';
```

## Functions

### checkFileExistsCaseInsensitive(filePath)

Checks if a file exists with case-insensitive matching on Windows.

**Parameters:**
- `filePath` (string): Path to check

**Returns:** Promise<Object>
```javascript
{
  exists: boolean,
  actualPath: string | null,
  error: string | null
}
```

**Example:**
```javascript
const result = await checkFileExistsCaseInsensitive('C:\\Users\\test\\FILE.txt');
// On Windows: { exists: true, actualPath: 'C:\\Users\\test\\file.txt' }
```

### handleLongPath(inputPath)

Handles long paths on Windows by adding the `\\?\` prefix when needed.

**Parameters:**
- `inputPath` (string): Path to process

**Returns:** Object
```javascript
{
  path: string,
  isLongPath: boolean,
  exceedsMaxPath: boolean,
  error: string | null
}
```

**Example:**
```javascript
const result = handleLongPath('C:\\very\\long\\path\\...');
// { path: '\\\\?\\C:\\very\\long\\path\\...', isLongPath: true, exceedsMaxPath: true }
```

**Notes:**
- Windows MAX_PATH is 260 characters
- Paths exceeding this limit automatically get the `\\?\` prefix
- UNC paths get the `\\?\UNC\` prefix

### checkWindowsPermissions(targetPath)

Checks Windows ACL permissions for a file or directory.

**Parameters:**
- `targetPath` (string): Path to check permissions for

**Returns:** Promise<Object>
```javascript
{
  readable: boolean,
  writable: boolean,
  executable: boolean,
  error: string | null
}
```

**Example:**
```javascript
const perms = await checkWindowsPermissions('C:\\Users\\test\\file.txt');
// { readable: true, writable: true, executable: false, error: null }
```

### resolveSymlink(linkPath)

Resolves Windows symlinks and junctions to their target paths.

**Parameters:**
- `linkPath` (string): Path to the symlink or junction

**Returns:** Promise<Object>
```javascript
{
  isSymlink: boolean,
  isJunction: boolean,
  targetPath: string | null,
  error: string | null
}
```

**Example:**
```javascript
const result = await resolveSymlink('C:\\Users\\link');
// { isSymlink: true, targetPath: 'C:\\Users\\actual', isJunction: false }
```

### readDirectoryWithHidden(dirPath, options)

Reads directory contents including hidden and system files on Windows.

**Parameters:**
- `dirPath` (string): Directory path to read
- `options` (Object): Optional configuration
  - `includeHidden` (boolean): Include hidden files (default: true)
  - `includeSystem` (boolean): Include system files (default: true)

**Returns:** Promise<Object>
```javascript
{
  files: Array<FileInfo>,
  error: string | null
}
```

**FileInfo Structure:**
```javascript
{
  name: string,
  path: string,
  isDirectory: boolean,
  isFile: boolean,
  isSymbolicLink: boolean,
  size: number,
  modified: Date,
  created: Date,
  isHidden: boolean,
  isSystem: boolean
}
```

**Example:**
```javascript
const result = await readDirectoryWithHidden('C:\\Users\\test');
// { files: [...], error: null }

// Exclude hidden files
const result = await readDirectoryWithHidden('C:\\Users\\test', { 
  includeHidden: false 
});
```

### createDirectorySafe(dirPath, options)

Safely creates a directory handling long paths on Windows.

**Parameters:**
- `dirPath` (string): Directory path to create
- `options` (Object): Optional configuration
  - `recursive` (boolean): Create parent directories (default: true)

**Returns:** Promise<Object>
```javascript
{
  success: boolean,
  path: string | null,
  alreadyExists: boolean,
  error: string | null
}
```

**Example:**
```javascript
const result = await createDirectorySafe('C:\\very\\long\\path\\...');
// { success: true, path: '...', alreadyExists: false, error: null }
```

### checkPathLength(inputPath)

Checks if a path exceeds Windows MAX_PATH limit.

**Parameters:**
- `inputPath` (string): Path to check

**Returns:** Object
```javascript
{
  length: number,
  exceedsMaxPath: boolean,
  maxPath: number,
  error: string | null
}
```

**Example:**
```javascript
const result = checkPathLength('C:\\very\\long\\path\\...');
// { length: 275, exceedsMaxPath: true, maxPath: 260 }
```

### getFileInfo(filePath)

Gets comprehensive file information including Windows-specific attributes.

**Parameters:**
- `filePath` (string): Path to get information for

**Returns:** Promise<Object>
```javascript
{
  exists: boolean,
  path: string,
  isDirectory: boolean,
  isFile: boolean,
  isSymbolicLink: boolean,
  size: number,
  created: Date,
  modified: Date,
  accessed: Date,
  isHidden: boolean,
  isSystem: boolean,
  permissions: Object,
  symlinkTarget: string | null,
  isJunction: boolean,
  error: string | null
}
```

**Example:**
```javascript
const info = await getFileInfo('C:\\Users\\test\\file.txt');
// { exists: true, isHidden: false, isSystem: false, permissions: {...}, ... }
```

## Platform Behavior

### Windows
- All functions provide full Windows-specific functionality
- Long path handling is automatically applied when needed
- Case-insensitive file operations are used
- Hidden and system file attributes are detected

### macOS/Linux
- Functions work but with platform-appropriate behavior
- Long path handling is not applied (not needed)
- Case-sensitive file operations are used
- Hidden files are detected by `.` prefix

## Best Practices

1. **Always use these utilities** when working with file paths that may be long or need case-insensitive handling
2. **Check path length** before operations on Windows to avoid MAX_PATH errors
3. **Handle errors gracefully** - all functions return error information
4. **Use case-insensitive checks** when user input may have different casing
5. **Resolve symlinks** when you need the actual file location

## Error Handling

All functions return error information in their result objects:

```javascript
const result = await checkFileExistsCaseInsensitive(somePath);
if (result.error) {
  console.error('Error:', result.error);
  // Handle error
} else {
  // Use result
}
```

## Testing

Run the test suite:

```bash
node test-windows-filesystem.js
```

The test suite includes 48 tests covering all functions and edge cases.

## Related Modules

- **pathUtils.js**: Cross-platform path utilities
- **pathSecurityValidator.js**: Path security and validation
- **config.js**: Configuration management

## References

- [Windows MAX_PATH Limitation](https://docs.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation)
- [Windows Long Path Support](https://docs.microsoft.com/en-us/windows/win32/fileio/naming-a-file#maximum-path-length-limitation)
- [Windows File Attributes](https://docs.microsoft.com/en-us/windows/win32/fileio/file-attribute-constants)
