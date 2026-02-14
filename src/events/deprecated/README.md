# Deprecated Event Modules

This directory contains deprecated event system modules that are kept **for test compatibility only**.

## ⚠️ WARNING: DO NOT USE IN PRODUCTION CODE

The files in this directory are deprecated and should **NOT** be imported or used in any production code. They are maintained solely to support backward compatibility in existing test files.

## Files

### compatibilityLayer.js
- **Status:** Deprecated
- **Reason:** Adapter layer no longer needed with direct event system usage
- **Usage:** Test files only (via callbackRegistry)
- **Migration:** Use event system directly instead of through compatibility layer

## Purpose

The compatibility layer was created to bridge the old callback registry API with the new event system. Now that production code uses the event system directly, this layer is only needed for test backward compatibility.

## Migration Guide

For production code, use the modern event system directly:

```javascript
// OLD (DEPRECATED):
import { callbackRegistry } from './core/deprecated/callbackRegistry.js';
// (which internally uses compatibilityLayer)

// NEW (RECOMMENDED):
import { systemEvents, WINDOW_EVENTS } from './events/systemEvents.js';
systemEvents.on(WINDOW_EVENTS.CREATED, callback);
```

See the main migration guide at `docs/CALLBACK_MIGRATION_GUIDE.md` for complete details.

## Removal Timeline

This file will be maintained as long as the deprecated callbackRegistry requires it. Once all tests are migrated to the new event system, this file may be removed entirely.
