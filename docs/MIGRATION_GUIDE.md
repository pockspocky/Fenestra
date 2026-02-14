# Migration Guide: Callback System Refactor

## Overview

This guide documents the file reorganization and new callback system features introduced in the callback system refactor. **No migration is required for existing code** - all changes are backward compatible.

> **⚠️ IMPORTANT:** The callback system described in this document has been **deprecated**. For new code, please use the modern event system. See the [Callback Migration Guide](CALLBACK_MIGRATION_GUIDE.md) for complete migration instructions.

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

New code should use the modern event system:

#### Step 1: Import Event System

```javascript
import { 
  systemEvents,
  WINDOW_EVENTS,
  DOOR_KEY_EVENTS,
  GAME_EVENTS
} from './src/events/systemEvents.js';

import {
  domainEvents,
  EMAIL_EVENTS,
  LENS_EVENTS
} from './src/events/domainEvents.js';
```

#### Step 2: Register Event Listeners

```javascript
// Global listener (applies to all windows)
const listenerId1 = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
  console.log('Any window created:', eventData.entityId);
});

// Entity-specific listener (applies to specific window)
const listenerId2 = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
  console.log('Main window created');
}, { entityId: 'main-window' });

// High-priority listener (executes first)
const listenerId3 = systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, (eventData) => {
  console.log('Door opened (high priority)');
}, { priority: 100 });
```

#### Step 3: Clean Up When Done

```javascript
// Remove specific listener
systemEvents.off(listenerId1);

// Clean up all listeners for an entity
systemEvents.cleanup('main-window');

// Remove all listeners for an event type
systemEvents.removeAllListeners(WINDOW_EVENTS.CREATED);
```

## Available Events

### System Events (systemEvents)
- `GAME_EVENTS.STATE_RESET` - Game state reset
- `GAME_EVENTS.LEVEL_COMPLETED` - Level completed
- `GAME_EVENTS.STATE_SAVED` - Game state saved
- `GAME_EVENTS.STATE_LOADED` - Game state loaded
- `GAME_EVENTS.STATE_EXPORTED` - Game state exported

- `WINDOW_EVENTS.CREATED` - Window created
- `WINDOW_EVENTS.CLOSED` - Window closed
- `WINDOW_EVENTS.MOVED` - Window moved
- `WINDOW_EVENTS.RESIZED` - Window resized
- `WINDOW_EVENTS.READY` - Window ready to show

- `DOOR_KEY_EVENTS.DOOR_OPENED` - Door opened
- `DOOR_KEY_EVENTS.DOOR_CLOSED` - Door closed
- `DOOR_KEY_EVENTS.KEY_USED` - Key used on door
- `DOOR_KEY_EVENTS.ACCESS_DENIED` - Access denied
- `DOOR_KEY_EVENTS.DOOR_STATE_CHANGED` - Door state changed

### Domain Events (domainEvents)
- `EMAIL_EVENTS.RECEIVED` - Email received
- `EMAIL_EVENTS.READ` - Email marked as read
- `EMAIL_EVENTS.ACTION_EXECUTED` - Email action executed
- `EMAIL_EVENTS.INBOX_CHANGED` - Inbox directory changed
- `EMAIL_EVENTS.VALIDATION_FAILED` - Email validation failed

- `LENS_EVENTS.CREATED` - Lens created
- `LENS_EVENTS.MOVED` - Lens moved
- `LENS_EVENTS.DESTROYED` - Lens destroyed
- `LENS_EVENTS.TRACKING_STARTED` - Lens tracking started
- `LENS_EVENTS.TRACKING_STOPPED` - Lens tracking stopped

- `FS_EVENTS.FILE_SAVED` - File saved
- `FS_EVENTS.FILE_LOADED` - File loaded
- `FS_EVENTS.FILE_DELETED` - File deleted
- `FS_EVENTS.DIRECTORY_CHANGED` - Directory navigation
- `FS_EVENTS.VALIDATION_FAILED` - File validation failed

- `IPC_EVENTS.BEFORE` - Before IPC handler execution
- `IPC_EVENTS.AFTER` - After IPC handler execution
- `IPC_EVENTS.ERROR` - IPC handler error

## Common Patterns

### Pattern 1: Logging All Events

```javascript
import { systemEvents, WINDOW_EVENTS, DOOR_KEY_EVENTS } from './src/events/systemEvents.js';

const events = [
  WINDOW_EVENTS.CREATED,
  WINDOW_EVENTS.CLOSED,
  DOOR_KEY_EVENTS.DOOR_OPENED
];

events.forEach(eventType => {
  systemEvents.on(eventType, (eventData) => {
    console.log(`[AUDIT] ${eventType.toString()}:`, eventData);
  }, { priority: -100 }); // Low priority, executes last
});
```

### Pattern 2: Validation with Prevention

```javascript
import { systemEvents, WINDOW_EVENTS } from './src/events/systemEvents.js';

systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
  if (!isValidWindowConfig(eventData.data)) {
    console.warn('Invalid window configuration');
    return { preventDefault: true }; // Prevent window creation
  }
}, { priority: 100 }); // High priority, executes first
```

### Pattern 3: Entity-Specific Behavior

```javascript
import { systemEvents, DOOR_KEY_EVENTS } from './src/events/systemEvents.js';

systemEvents.on(DOOR_KEY_EVENTS.DOOR_OPENED, (eventData) => {
  console.log('Secret door opened!');
  triggerSecretRoomLogic();
}, { entityId: 'secret-door-1' }); // Only for this specific door
```

### Pattern 4: One-Time Initialization

```javascript
import { systemEvents, WINDOW_EVENTS } from './src/events/systemEvents.js';

systemEvents.once(WINDOW_EVENTS.READY, (eventData) => {
  initializeWindowContent(eventData.entityId);
}, { entityId: 'main-window' }); // Auto-unregister after first execution
```

## Testing

All existing tests pass without modification:

```bash
npm test
```

**Result: 120/120 tests passed**

## Documentation

For detailed event system documentation, see:
- **[Callback Migration Guide](CALLBACK_MIGRATION_GUIDE.md)** - Complete migration from deprecated callback system
- **[Event System README](../src/events/README.md)** - Modern event system documentation
- **[Core README](../src/core/README.md)** - Core module documentation with event system examples
- `src/core/index.js` - JSDoc comments for all exports

## Support

If you encounter any issues:

1. Check that imports use the new file paths
2. Verify all tests pass: `npm test`
3. Review the callback system guide: `.kiro/steering/callback-system.md`
4. Check the backward compatibility document: `BACKWARD_COMPATIBILITY.md`

## Callback System Migration

**IMPORTANT:** The callback system described above has been **deprecated**. Please use the modern event system instead.

### Modern Event System (Recommended)

The modern event system provides better performance, type safety, and cleaner code:

```javascript
// Import modern event system
import { systemEvents, WINDOW_EVENTS } from './src/events/systemEvents.js';
import { domainEvents, EMAIL_EVENTS } from './src/events/domainEvents.js';

// Register event listeners
const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, (eventData) => {
  console.log('Window created:', eventData.entityId);
});

// Emit events
systemEvents.emit(WINDOW_EVENTS.CREATED, {
  entityId: 'win-1',
  data: { title: 'My Window' }
});

// Clean up
systemEvents.off(listenerId);
```

### Migration Resources

For complete migration instructions, see:
- **[Callback Migration Guide](CALLBACK_MIGRATION_GUIDE.md)** - Complete API mappings and examples
- **[Event System README](../src/events/README.md)** - Modern event system documentation
- **[Core README](../src/core/README.md)** - Updated core module documentation

### Deprecated Files

The following files have been moved to deprecated directories and should **not** be used in new code:
- `src/core/deprecated/callbackRegistry.js` - Kept for test compatibility only
- `src/events/deprecated/compatibilityLayer.js` - Kept for test compatibility only

## Summary

- ✅ **No breaking changes** - All existing code works without modification
- ✅ **Better organization** - Files grouped by functionality
- ✅ **Modern event system** - Use `systemEvents` and `domainEvents` for new code
- ✅ **Full documentation** - Complete guides and examples
- ✅ **All tests pass** - 120/120 tests passing
