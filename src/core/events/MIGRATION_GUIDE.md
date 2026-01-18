# Event System Migration Guide

## Overview

The callback system has been refactored from a complex 7-module system to a simpler 3-module event-based architecture. This guide helps you migrate from the old callback API to the new event system.

## What Changed

### Old System (Deprecated)
- `callbackRegistry` - Complex registry with priority and entity tracking
- `callbackFactory` - Factory for generating callback modules
- 7 separate callback modules with boilerplate

### New System
- `EventEmitter` - Simple event emitter with listener tracking
- `systemEvents` - Game state, window, and door/key events
- `domainEvents` - Email, lens, file system, and IPC events
- `eventTracing` - Debugging and monitoring utilities

## Migration Steps

### Step 1: Update Imports

**Old:**
```javascript
import { callbackRegistry } from './core/callbackRegistry.js';
import { registerWindowCreatedCallback } from './core/callbacks/windowCallbacks.js';
```

**New:**
```javascript
import { systemEvents, WINDOW_EVENTS } from './core/events/systemEvents.js';
import { registerWindowCreatedCallback } from './core/callbacks/windowCallbacks.js'; // Still works!
```

### Step 2: Update Event Registration

**Old:**
```javascript
const regId = callbackRegistry.register('window-created', (eventType, context) => {
  console.log('Window created:', context.entityId);
  console.log('Data:', context.data);
}, { entityId: 'window-1', priority: 10 });
```

**New:**
```javascript
const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, (data) => {
  console.log('Window created:', data.entityId);
  console.log('Data:', data);
}, { entityId: 'window-1' });
```

**Key Changes:**
- Callback signature changed from `(eventType, context)` to `(data)`
- No more `priority` option (simplified execution order)
- Event names are now constants (e.g., `WINDOW_EVENTS.CREATED`)

### Step 3: Update Event Emission

**Old:**
```javascript
callbackRegistry.execute('window-created', {
  entityId: 'window-1',
  timestamp: Date.now(),
  source: 'windowManager',
  data: { width: 800, height: 600 }
});
```

**New:**
```javascript
systemEvents.emit(WINDOW_EVENTS.CREATED, {
  entityId: 'window-1',
  timestamp: Date.now(),
  source: 'windowManager',
  width: 800,
  height: 600
});
```

**Key Changes:**
- Use `emit()` instead of `execute()`
- Data is flattened (no nested `data` object)
- Returns `{ executed, errors }` instead of `{ executed, prevented, errors }`

### Step 4: Update Cleanup

**Old:**
```javascript
callbackRegistry.clearEntity('window-1');
callbackRegistry.unregister(regId);
```

**New:**
```javascript
systemEvents.cleanup('window-1');
systemEvents.off(listenerId);
```

## Event Mapping

### System Events (systemEvents)

| Old Event String | New Event Constant |
|-----------------|-------------------|
| `'state-reset'` | `GAME_EVENTS.STATE_RESET` |
| `'level-completed'` | `GAME_EVENTS.LEVEL_COMPLETED` |
| `'state-exported'` | `GAME_EVENTS.STATE_EXPORTED` |
| `'window-created'` | `WINDOW_EVENTS.CREATED` |
| `'window-closed'` | `WINDOW_EVENTS.CLOSED` |
| `'door-opened'` | `DOOR_KEY_EVENTS.DOOR_OPENED` |
| `'key-used'` | `DOOR_KEY_EVENTS.KEY_USED` |

### Domain Events (domainEvents)

| Old Event String | New Event Constant |
|-----------------|-------------------|
| `'email-received'` | `EMAIL_EVENTS.RECEIVED` |
| `'email-read'` | `EMAIL_EVENTS.READ` |
| `'lens-created'` | `LENS_EVENTS.CREATED` |
| `'file-saved'` | `FS_EVENTS.FILE_SAVED` |
| `'ipc-before'` | `IPC_EVENTS.BEFORE` |

## Using Callback Modules (Recommended)

The callback modules (windowCallbacks, doorKeyCallbacks, etc.) have been updated to use the new event system internally, but maintain the same external API. This is the easiest migration path:

```javascript
// This still works and uses the new event system internally!
import { 
  registerWindowCreatedCallback,
  triggerWindowCreated 
} from './core/callbacks/windowCallbacks.js';

const listenerId = registerWindowCreatedCallback((data) => {
  console.log('Window created:', data.entityId);
});

triggerWindowCreated('window-1', { width: 800, height: 600 });
```

**Note:** The callback signature changed from `(eventType, context)` to `(data)`.

## Backward Compatibility

The old `callbackRegistry` API is still available through a compatibility layer, but it's deprecated and will be removed in a future version. It logs warnings when used.

```javascript
// Still works but logs deprecation warnings
import { callbackRegistry } from './core/callbackRegistry.js';
callbackRegistry.register('window-created', callback);
```

## Debugging and Monitoring

The new system includes built-in tracing and monitoring:

```javascript
import { eventTracer } from './core/events/eventTracing.js';

// Enable tracing
eventTracer.enable();

// Get statistics
const stats = eventTracer.getStats();
console.log('Total events:', stats.totalEvents);
console.log('Average durations:', stats.averageDurations);

// Get slow listeners
const slow = eventTracer.getSlowListeners(100); // > 100ms

// Generate flow diagram
console.log(eventTracer.generateFlowDiagram());
```

## Benefits of the New System

1. **Simpler API** - No more priority, once, or preventDefault complexity
2. **Better Performance** - Lighter weight event emitter
3. **Easier Debugging** - Built-in tracing and monitoring
4. **Clearer Organization** - System vs domain events separation
5. **Less Boilerplate** - No factory pattern needed

## Common Patterns

### Pattern 1: Entity-Specific Listeners

```javascript
// Listen only to events for a specific window
systemEvents.on(WINDOW_EVENTS.CLOSED, (data) => {
  console.log('My window closed!');
}, { entityId: 'my-window' });
```

### Pattern 2: Cleanup on Destroy

```javascript
class MyComponent {
  constructor(id) {
    this.id = id;
    this.listenerIds = [];
    
    // Register listeners
    this.listenerIds.push(
      systemEvents.on(WINDOW_EVENTS.CREATED, this.handleCreated.bind(this))
    );
  }
  
  destroy() {
    // Clean up all listeners
    systemEvents.cleanup(this.id);
    
    // Or remove specific listeners
    this.listenerIds.forEach(id => systemEvents.off(id));
  }
}
```

### Pattern 3: Error Isolation

```javascript
// Errors in one listener don't affect others
systemEvents.on(WINDOW_EVENTS.CREATED, (data) => {
  throw new Error('This error is isolated');
});

systemEvents.on(WINDOW_EVENTS.CREATED, (data) => {
  console.log('This still executes!');
});
```

## Need Help?

If you encounter issues during migration:

1. Check the deprecation warnings in console logs
2. Review the callback module source code for examples
3. Use the compatibility layer temporarily while migrating
4. Enable event tracing to debug event flow

## Timeline

- **Current**: Both old and new systems work (compatibility layer)
- **Next Release**: Deprecation warnings added
- **Future Release**: Old system removed, new system only
