# Design Document

## Overview

This design document outlines the technical approach for enhancing the existing door key system with customizable messaging, one-time use keys, multi-key doors, and custom HTML content loading. The design maximally leverages existing infrastructure including the current `doorKeySystem.js` module, `windowManager.js` functions, and established patterns for Maps, Sets, and dialog handling.

## Architecture

### Current System Architecture

The existing door key system consists of:
- **doorKeySystem.js**: Core relationship management, permission checking, and door/key interactions
- **windowManager.js**: Window creation and management with `createDoor()` and `createKey()` functions
- **workerManager.js**: Overlap detection and interaction triggering
- **Data Structures**: `doorKeyRelations` Map, `keyDoorRelations` Map, `encryptedItems` Set, `doorStates` Map

### Enhanced Architecture

The enhanced system will extend the existing architecture with:
- **Message Configuration System**: New Maps for storing custom messages
- **Key Usage Tracking**: New Set for tracking one-time use keys and used keys
- **Multi-Key Door System**: Extended `doorStates` Map with progress tracking
- **Enhanced Window Creation**: Extended `createDoor()` and `createKey()` with `otherContents` support

## Components and Interfaces

### 1. Message Configuration System

#### New Data Structures
```javascript
// Global message templates
const globalMessages = new Map(); // messageType -> template
// Per-door message templates  
const doorMessages = new Map(); // doorId -> Map(messageType -> template)
// Per-key message templates
const keyMessages = new Map(); // keyId -> Map(messageType -> template)
```

#### Message Types
- `'door_opened'`: When door successfully opens
- `'door_closed'`: When door successfully closes  
- `'access_denied'`: When key cannot open door
- `'key_used'`: When one-time key is consumed
- `'key_closing'`: When one-time key window is about to close
- `'progress_update'`: When multi-key door progress advances
- `'sequence_complete'`: When multi-key door fully unlocks
- `'sequence_reset'`: When multi-key door sequence resets
- `'timeout'`: When multi-key door times out

#### New Exported Functions
```javascript
export function setGlobalMessage(messageType, template)
export function setDoorMessage(doorId, messageType, template)  
export function setKeyMessage(keyId, messageType, template)
export function clearMessages(scope, id) // scope: 'global'|'door'|'key'
```

### 2. One-Time Use Key System

#### New Data Structures
```javascript
// Keys configured as one-time use
const oneTimeKeys = new Set(); // keyId
// Keys that have been used and are now disabled
const usedKeys = new Set(); // keyId
// Keys that should be closed/hidden after use
const closeAfterUse = new Set(); // keyId
```

#### Enhanced Functions
- **canOpenDoor()**: Check if key is not in `usedKeys` Set before permission check
- **handleDoorToggle()**: Add successful key to `usedKeys` Set if in `oneTimeKeys` Set, and close/hide key window if in `closeAfterUse` Set using existing `getWindow(keyId).close()` or `getWindow(keyId).hide()`
- **New Functions**:
  ```javascript
  export function setKeyOneTimeUse(keyId, isOneTime, shouldCloseAfterUse = false)
  export function isKeyUsable(keyId)
  export function resetKeyUsage(keyId) // Remove from usedKeys
  export function setKeyCloseAfterUse(keyId, shouldClose)
  ```

### 3. Multi-Key Door System

#### Enhanced Data Structures
```javascript
// Extend existing doorStates Map with new fields:
doorStates.set(doorId, {
  isOpen: boolean,
  lastKeyUsed: string,
  // New fields:
  requiredKeys: Array, // [keyId1, keyId2, keyId3] - sequence order
  usedKeys: Array,     // [keyId1] - keys used so far in sequence
  timeoutId: number,   // setTimeout ID for auto-reset
  timeoutDuration: number // milliseconds before reset
});
```

#### New Configuration Functions
```javascript
export function setMultiKeyDoor(doorId, requiredKeySequence, timeoutMs)
export function getMultiKeyProgress(doorId)
export function resetMultiKeyProgress(doorId)
```

#### Enhanced Logic in Existing Functions
- **canOpenDoor()**: Check multi-key progress and validate next required key
- **handleDoorToggle()**: Update progress, manage timeouts, check completion
- **handleFailedOpen()**: Reset progress on wrong key

### 4. Enhanced Window Creation

#### Extended createDoor Function
```javascript
export function createDoor(doorId = 'door', title = null, encrypt = false, otherContents = null)
```
- Maintains existing signature for backward compatibility
- When `otherContents` provided, uses it instead of default `pictureViewer.html`
- Passes `doorId` through query parameters as existing system does

#### Extended createKey Function  
```javascript
export function createKey(keyId = 'key', title = null, encrypt = false, relatedDoors = [], otherContents = null)
```
- Maintains existing signature for backward compatibility
- When `otherContents` provided, uses it instead of default `index.html`
- Passes `keyId` through query parameters as existing system does

## Data Models

### Message Template Model
```javascript
{
  template: "Door {doorId} opened with key {keyId}!",
  variables: ['doorId', 'keyId', 'progress', 'nextKey', 'reason']
}
```

### Multi-Key Door Configuration Model
```javascript
{
  doorId: "door1",
  requiredKeys: ["key1", "key2", "key3"], // Sequence order matters
  timeoutDuration: 30000, // 30 seconds
  messages: {
    progress_update: "Key {keyId} accepted. Need {nextKey} next. ({progress}/{total})",
    sequence_complete: "All keys used! Door {doorId} unlocked!",
    sequence_reset: "Wrong key! Sequence reset.",
    timeout: "Timeout! Multi-key sequence reset."
  }
}
```

### One-Time Key Configuration Model
```javascript
{
  keyId: "key1",
  isOneTimeUse: true,
  isUsed: false,
  closeAfterUse: false, // Default: false - key window stays open but disabled
  messages: {
    key_used: "Key {keyId} consumed and can no longer be used.",
    already_used: "Key {keyId} has already been used and is no longer functional.",
    key_closing: "Key {keyId} used successfully. Closing key window."
  }
}
```

## Error Handling

### Message Template Validation
- Validate template strings contain only allowed variables
- Provide console warnings for invalid templates using existing logging pattern
- Fallback to default messages on template errors

### Multi-Key Door Error Handling
- Validate required key sequences are non-empty arrays
- Handle timeout cleanup on door deletion
- Reset progress on invalid configurations

### One-Time Key Error Handling  
- Validate key exists before marking as one-time use
- Handle edge cases where key is used multiple times simultaneously
- Provide clear error messages for already-used keys
- Handle window closing gracefully using existing window management patterns
- Validate key window exists before attempting to close using existing `getWindow(keyId)` check

## Testing Strategy

### Unit Testing Focus
- Message template parsing and variable substitution
- Multi-key door progress tracking logic
- One-time key usage state management
- Backward compatibility with existing function signatures

### Integration Testing Focus
- End-to-end multi-key door unlock sequences
- Message display integration with existing dialog system
- Custom HTML loading with otherContents parameter
- Interaction with existing workerManager.js overlap detection

### Compatibility Testing
- Existing demo functionality unchanged
- All existing function calls continue to work
- Performance impact on existing overlap detection loop
- Memory usage with new data structures

## Implementation Notes

### Backward Compatibility Strategy
1. All new parameters are optional with sensible defaults
2. Existing function signatures preserved exactly
3. New functionality only activates when explicitly configured
4. Default messages match current hardcoded text

### Performance Considerations
1. Message lookup uses existing Map.get() pattern for O(1) access
2. Multi-key progress stored in existing doorStates Map
3. One-time key checks use Set.has() for O(1) lookup
4. No changes to existing overlap detection performance

### Integration Points
1. **workerManager.js**: No changes required, continues calling existing functions
2. **gameLogic.js**: Can use new configuration functions during initialization
3. **windowManager.js**: Enhanced createDoor/createKey functions maintain compatibility
4. **Dialog System**: Continues using existing dialog.showMessageBox mechanism