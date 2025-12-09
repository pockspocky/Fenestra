# Import Path Fix - ipcHandlers.js

## Issue

When running `npm start`, the application failed with the following error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 
'/Users/ericzhong/Documents/GitHub/Fenestra/src/core/handlers/startMenuManager.js' 
imported from /Users/ericzhong/Documents/GitHub/Fenestra/src/core/handlers/ipcHandlers.js
```

## Root Cause

During Task 15 (Project Structure Reorganization), we moved `ipcHandlers.js` from `src/core/` to `src/core/handlers/`. However, the dynamic import statements inside `ipcHandlers.js` were not updated to reflect the new relative path structure.

The file was using `./` (same directory) when it should use `../` (parent directory) to access files in `src/core/`, or `../systems/` to access files in `src/core/systems/`.

## Files Affected

- `src/core/handlers/ipcHandlers.js`

## Changes Made

Fixed all incorrect dynamic import paths in `ipcHandlers.js`:

### 1. startMenuManager.js (2 occurrences)
```javascript
// BEFORE (incorrect)
await import('./startMenuManager.js')

// AFTER (correct)
await import('../startMenuManager.js')
```

### 2. config.js (4 occurrences)
```javascript
// BEFORE (incorrect)
await import('./config.js')

// AFTER (correct)
await import('../config.js')
```

### 3. emailStorage.js (4 occurrences)
```javascript
// BEFORE (incorrect)
await import('./emailStorage.js')

// AFTER (correct)
await import('../emailStorage.js')
```

### 4. emailActions.js (1 occurrence)
```javascript
// BEFORE (incorrect)
await import('./emailActions.js')

// AFTER (correct)
await import('../emailActions.js')
```

### 5. gameStateManager.js (2 occurrences)
```javascript
// BEFORE (incorrect)
await import('./gameStateManager.js')

// AFTER (correct)
await import('../systems/gameStateManager.js')
```

### 6. doorKeySystem.js (4 occurrences)
```javascript
// BEFORE (incorrect)
await import('./doorKeySystem.js')

// AFTER (correct)
await import('../systems/doorKeySystem.js')
```

### 7. directoryNavigator.js (1 occurrence)
```javascript
// BEFORE (incorrect)
await import('./utils/directoryNavigator.js')

// AFTER (correct)
await import('../utils/directoryNavigator.js')
```

## Total Changes

- **18 import statements fixed**
- All paths now correctly reference files relative to `src/core/handlers/`

## File Location Reference

From `src/core/handlers/ipcHandlers.js`:

- `../` → `src/core/` (parent directory)
  - config.js
  - emailStorage.js
  - emailActions.js
  - startMenuManager.js
  - windowStorage.js

- `../systems/` → `src/core/systems/`
  - windowManager.js
  - doorKeySystem.js
  - gameStateManager.js
  - gameLogic.js
  - lensSystem.js
  - emailSystem.js

- `../utils/` → `src/core/utils/`
  - pathSecurityValidator.js
  - directoryNavigator.js
  - errorHandler.js
  - etc.

## Testing

After applying these fixes, the application should start successfully without module resolution errors.

To verify:
```bash
npm start
```

The application should initialize without the `ERR_MODULE_NOT_FOUND` error.

## Prevention

When moving files during reorganization:
1. Update all static imports at the top of files
2. Search for dynamic imports (`await import()`) and update those too
3. Use grep to find all import statements: `grep -n "import.*from\|await import" filename.js`
4. Test the application after reorganization to catch any missed imports

## Related Tasks

- Task 15: Reorganize Project Structure
- Task 16: Update All Import Statements

This fix completes the import statement updates that were part of Task 16.
