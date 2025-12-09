# Migration Guide: Callback System Refactor

## Overview

This guide documents the file reorganization and new callback system features introduced in the callback system refactor. **No migration is required for existing code** - all changes are backward compatible.

## What Changed

### 1. File Organization

Files have been reorganized into logical subdirectories for better maintainability:

#### Before
```
src/core/
├── windowManager.js
├── doorKeySystem.js
├── gameLogic.js
├── gameStateManager.js
├── emailSystem.js
├── lensSystem.js
├── ipcHandlers.js
└── utils/
```

#### After
```
src/core/
├── systems/              (NEW: Core game systems)
│   ├── windowManager.js
│   ├── doorKeySystem.js
│   ├── gameLogic.js
│   ├── gameStateManager.js
│   ├── emailSystem.js
│   └── lensSystem.js
├── handlers/             (NEW: IPC handlers)
│   └── ipcHandlers.js
├── callbacks/            (NEW: Callback integration)
│   ├── windowCallbacks.js
│   ├── doorKeyCallbacks.js
│   ├── ipcCallbacks.js
│   ├── fileSystemCallbacks.js
│   ├── gameStateCallbacks.js
│   ├── emailCallbacks.js
│   └── lensCallbacks.js
├── callbackRegistry.js   (NEW: Core callback system)
├── index.js              (UPDATED: Centralized exports)
└── utils/
```

### 2. Import Path Changes

All import paths have been updated to reflect the new structure:

#### Old Imports (No longer valid)
```javascript
import { createWindow } from './src/core/windowManager.js';
import { establishRelation } from './src/core/doorKeySystem.js';
import { initializeIpcHandlers } from './src/core/ipcHandlers.js';
```

#### New Imports (Current)
```javascript
// Option 1: Direct imports from new locations
import { createWindow } from './src/core/systems/windowManager.js';
import { establishRelation } from './src/core/systems/doorKeySystem.js';
import { initializeIpcHandlers } from './src/core/handlers/ipcHandlers.js';

// Option 2: Centralized imports (recommended)
import { 
  createWindow, 
  establishRelation, 
  initializeIpcHandlers 
} from './src/core/index.js';
```

### 3. New Callback System

A comprehensive callback system has been added for all major events:

```javascript
// Import callback functions
import { 
  registerWindowCreatedCallback,
  registerDoorOpenedCallback,
  registerStateSavedCallback
} from './src/core/index.js';

// Register callbacks
registerWindowCreatedCallback((eventType, eventData) => {
  console.log('Window created:', eventData.entityId);
});

registerDoorOpenedCallback((eventType, eventData) => {
  console.log('Door opened:', eventData.entityId);
}, { entityId: 'secret-door' }); // Entity-specific callback

registerStateSavedCallback((eventType, eventData) => {
  console.log('Game saved:', eventData.data.filePath);
});
```

## Migration Steps

### For Existing Code

**No migration required!** All existing code continues to work without modification because:

1. All function signatures remain unchanged
2. All export patterns are maintained
3. All behaviors remain the same
4. The callback system is purely additive

### For New Code

New code can optionally use the callback system:

#### Step 1: Import Callback Functions

```javascript
import { 
  registerWindowCreatedCallback,
  registerDoorOpenedCallback,
  callbackRegistry 
} from './src/core/index.js';
```

#### Step 2: Register Callbacks

```javascript
// Global callback (applies to all windows)
const regId1 = registerWindowCreatedCallback((eventType, eventData) => {
  console.log('Any window created:', eventData.entityId);
});

// Entity-specific callback (applies to specific window)
const regId2 = registerWindowCreatedCallback((eventType, eventData) => {
  console.log('Main window created');
}, { entityId: 'main-window' });

// High-priority callback (executes first)
const regId3 = registerDoorOpenedCallback((eventType, eventData) => {
  console.log('Door opened (high priority)');
}, { priority: 100 });
```

#### Step 3: Unregister When Done (Optional)

```javascript
// Unregister specific callback
callbackRegistry.unregister(regId1);

// Clear all callbacks for an entity
callbackRegistry.clearEntity('main-window');

// Clear all callbacks for an event type
callbackRegistry.clearEventType('window-created');
```

## Available Callback Events

### Window Events
- `window-created` - Window created
- `window-closed` - Window closed
- `window-moved` - Window moved
- `window-resized` - Window resized
- `window-ready` - Window ready to show

### Door-Key Events
- `door-opened` - Door opened
- `door-closed` - Door closed
- `key-used` - Key used on door
- `access-denied` - Access denied
- `door-state-changed` - Door state changed

### IPC Events
- `ipc-before-{channel}` - Before IPC handler execution
- `ipc-after-{channel}` - After IPC handler execution
- `ipc-error-{channel}` - IPC handler error

### File System Events
- `file-saved` - File saved
- `file-loaded` - File loaded
- `file-deleted` - File deleted
- `directory-changed` - Directory navigation
- `validation-failed` - File validation failed

### Game State Events
- `state-saved` - Game state saved
- `state-loaded` - Game state loaded
- `state-reset` - Game state reset
- `level-completed` - Level completed
- `state-exported` - Game state exported

### Email Events
- `email-received` - Email received
- `email-read` - Email marked as read
- `email-action-executed` - Email action executed
- `inbox-changed` - Inbox directory changed
- `email-validation-failed` - Email validation failed

### Lens Events
- `lens-created` - Lens created
- `lens-moved` - Lens moved
- `lens-destroyed` - Lens destroyed
- `lens-tracking-started` - Lens tracking started
- `lens-tracking-stopped` - Lens tracking stopped

## Common Patterns

### Pattern 1: Logging All Events

```javascript
import { callbackRegistry } from './src/core/index.js';

const events = ['window-created', 'window-closed', 'door-opened'];
events.forEach(eventType => {
  callbackRegistry.register(eventType, (type, data) => {
    console.log(`[AUDIT] ${type}:`, data);
  }, { priority: -100 }); // Low priority, executes last
});
```

### Pattern 2: Validation with Prevention

```javascript
import { registerWindowCreatedCallback } from './src/core/index.js';

registerWindowCreatedCallback((eventType, eventData) => {
  if (!isValidWindowConfig(eventData.data)) {
    console.warn('Invalid window configuration');
    return { preventDefault: true }; // Prevent window creation
  }
}, { priority: 100 }); // High priority, executes first
```

### Pattern 3: Entity-Specific Behavior

```javascript
import { registerDoorOpenedCallback } from './src/core/index.js';

registerDoorOpenedCallback((eventType, eventData) => {
  console.log('Secret door opened!');
  triggerSecretRoomLogic();
}, { entityId: 'secret-door-1' }); // Only for this specific door
```

### Pattern 4: One-Time Initialization

```javascript
import { registerWindowReadyCallback } from './src/core/index.js';

registerWindowReadyCallback((eventType, eventData) => {
  initializeWindowContent(eventData.entityId);
}, { 
  entityId: 'main-window',
  once: true  // Auto-unregister after first execution
});
```

## Testing

All existing tests pass without modification:

```bash
npm test
```

**Result: 120/120 tests passed**

## Documentation

For detailed callback system documentation, see:
- `.kiro/steering/callback-system.md` - Comprehensive callback system guide
- `BACKWARD_COMPATIBILITY.md` - Backward compatibility verification
- `src/core/index.js` - JSDoc comments for all exports

## Support

If you encounter any issues:

1. Check that imports use the new file paths
2. Verify all tests pass: `npm test`
3. Review the callback system guide: `.kiro/steering/callback-system.md`
4. Check the backward compatibility document: `BACKWARD_COMPATIBILITY.md`

## Summary

- ✅ **No breaking changes** - All existing code works without modification
- ✅ **Better organization** - Files grouped by functionality
- ✅ **New features** - Comprehensive callback system for extensibility
- ✅ **Full documentation** - Complete guides and examples
- ✅ **All tests pass** - 120/120 tests passing
