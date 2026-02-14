# Deprecated Core Modules

This directory contains deprecated core modules that are kept **for test compatibility only**.

## ⚠️ WARNING: DO NOT USE IN PRODUCTION CODE

The files in this directory are deprecated and should **NOT** be imported or used in any production code. They are maintained solely to support backward compatibility in existing test files.

## Files

### callbackRegistry.js
- **Status:** Deprecated
- **Reason:** Replaced by modern event system (systemEvents/domainEvents)
- **Usage:** Test files only
- **Migration:** Use `systemEvents.on()` or `domainEvents.on()` instead

## Migration Guide

For production code, use the modern event system:

```javascript
// OLD (DEPRECATED):
import { callbackRegistry } from './core/deprecated/callbackRegistry.js';
const regId = callbackRegistry.register('window-created', callback);

// NEW (RECOMMENDED):
import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
const listenerId = systemEvents.on(WINDOW_EVENTS.CREATED, callback);
```

See the main migration guide at `docs/CALLBACK_MIGRATION_GUIDE.md` for complete details.

## Removal Timeline

These files will be maintained as long as test files require them. Once all tests are migrated to the new event system, these files may be removed entirely.
