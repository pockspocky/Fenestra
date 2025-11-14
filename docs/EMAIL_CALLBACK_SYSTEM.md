# Email Callback System

## Overview

The Email Callback System allows you to create custom email actions by registering JavaScript callback functions. This provides unlimited flexibility for email interactions without modifying the core email system.

## Quick Start

### 1. Register a Callback

```javascript
import { registerEmailCallback } from './src/core/emailActions.js';

registerEmailCallback('myAction', (arg1, arg2) => {
  console.log('Action triggered!', arg1, arg2);
  
  // Your custom logic here
  
  return {
    success: true,
    message: 'Action completed',
    data: { arg1, arg2 }
  };
});
```

### 2. Create an Email with Callback Action

```json
{
  "id": "my-email",
  "senderName": "System",
  "senderEmail": "system@fenestra.com",
  "subject": "Test Email",
  "body": "Click the button to trigger the callback.",
  "timestamp": "2025-11-13T10:00:00Z",
  "isRead": false,
  "actions": [
    {
      "label": "Click Me",
      "type": "callback",
      "parameters": {
        "name": "myAction",
        "args": ["value1", "value2"]
      }
    }
  ]
}
```

### 3. User Clicks Button

When the user clicks the button in the email, your registered callback will be executed with the provided arguments.

## API Reference

### registerEmailCallback(name, callback)

Registers a callback function for email actions.

**Parameters:**
- `name` (string): Unique name for the callback
- `callback` (function): Function to execute when action is triggered

**Returns:**
- Object with `success` and `message` properties

**Example:**
```javascript
registerEmailCallback('startQuest', (questId, difficulty) => {
  // Your logic
  return { success: true, questId, difficulty };
});
```

### unregisterEmailCallback(name)

Removes a registered callback.

**Parameters:**
- `name` (string): Name of the callback to unregister

**Returns:**
- Object with `success` and `message` properties

### getRegisteredCallbacks()

Gets list of all registered callback names.

**Returns:**
- Array of callback names (strings)

**Example:**
```javascript
const callbacks = getRegisteredCallbacks();
console.log('Registered:', callbacks);
// Output: ['startQuest', 'completeLevel', 'unlockDoor']
```

### isCallbackRegistered(name)

Checks if a callback is registered.

**Parameters:**
- `name` (string): Callback name to check

**Returns:**
- Boolean (true if registered)

**Example:**
```javascript
if (isCallbackRegistered('startQuest')) {
  console.log('Quest callback is ready');
}
```

### clearAllCallbacks()

Removes all registered callbacks.

**Returns:**
- Object with `success`, `message`, and `count` properties

## Advantages Over Predefined Actions

### Before (Limited Actions)

You were limited to predefined action types:
- `createWindow`
- `createDoor`
- `createLens`
- `executeFunction` (with whitelist)
- `openPath`

### After (Unlimited Flexibility)

With callbacks, you can:
- Create any custom action
- Combine multiple operations
- Access full game state
- Perform async operations
- Return custom results

## Common Use Cases

### 1. Quest System

```javascript
registerEmailCallback('acceptQuest', (questId, difficulty, rewards) => {
  // Create quest windows
  createDoor(`quest-${questId}-door`, 'Quest Door', true);
  createKey(`quest-${questId}-key`, 'Quest Key', true);
  
  // Update game state
  gameState.activeQuests.push({ questId, difficulty, rewards });
  
  return { success: true, questId };
});
```

### 2. Level Progression

```javascript
registerEmailCallback('startLevel', (levelId, config) => {
  // Load level data
  const levelData = loadLevel(levelId);
  
  // Create level windows
  setupLevelWindows(levelData, config);
  
  // Initialize level state
  gameState.currentLevel = levelId;
  
  return { success: true, levelId };
});
```

### 3. Inventory Management

```javascript
registerEmailCallback('receiveItem', (itemId, quantity) => {
  // Add to inventory
  inventory.addItem(itemId, quantity);
  
  // Show notification
  showNotification(`Received ${quantity}x ${itemId}`);
  
  return { success: true, itemId, quantity };
});
```

### 4. Puzzle Setup

```javascript
registerEmailCallback('setupPuzzle', (puzzleId, config) => {
  // Create puzzle elements
  createContentWindow(puzzleId, config);
  createLensWindows(puzzleId, config.lensCount);
  
  // Initialize puzzle state
  puzzleState[puzzleId] = { started: Date.now(), config };
  
  return { success: true, puzzleId };
});
```

## Best Practices

### 1. Use Descriptive Names

```javascript
// Good
registerEmailCallback('startBossLevel', ...);
registerEmailCallback('unlockSecretArea', ...);

// Avoid
registerEmailCallback('cb1', ...);
registerEmailCallback('func', ...);
```

### 2. Handle Errors

```javascript
registerEmailCallback('myCallback', (...args) => {
  try {
    // Your logic
    return { success: true };
  } catch (error) {
    console.error('Callback error:', error);
    return { success: false, error: error.message };
  }
});
```

### 3. Return Consistent Structure

```javascript
// Always return an object with at least 'success'
return {
  success: true,
  message: 'Operation completed',
  data: { ... }
};
```

### 4. Validate Arguments

```javascript
registerEmailCallback('processData', (data) => {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid data' };
  }
  // Process data
});
```

### 5. Register During Initialization

```javascript
// In main.js or initialization code
function initializeCallbacks() {
  registerEmailCallback('callback1', ...);
  registerEmailCallback('callback2', ...);
  registerEmailCallback('callback3', ...);
}

initializeCallbacks();
```

## Security Considerations

### Callback Registry

- Only registered callbacks can be executed
- Callbacks are stored in a private Map
- No dynamic code execution
- Full control over what functions are available

### Validation

- Callback name must be registered
- Parameters are validated before execution
- Errors are caught and logged
- Failed callbacks don't crash the system

## Migration Guide

### From executeFunction to Callback

**Before:**
```json
{
  "type": "executeFunction",
  "parameters": {
    "functionName": "startQuest",
    "args": ["quest-1"]
  }
}
```

**After:**
```javascript
// Register the callback
registerEmailCallback('startQuest', (questId) => {
  // Your logic
});
```

```json
{
  "type": "callback",
  "parameters": {
    "name": "startQuest",
    "args": ["quest-1"]
  }
}
```

## Examples

See `examples/email-callback-example.js` for complete working examples including:
- Simple callbacks
- Quest system
- Level progression
- Inventory management
- Multi-step operations
- Async callbacks

## Troubleshooting

### Callback Not Found Error

**Error:** `Callback 'myCallback' is not registered`

**Solution:** Register the callback before using it in an email
```javascript
registerEmailCallback('myCallback', () => { ... });
```

### Callback Not Executing

**Check:**
1. Callback is registered: `isCallbackRegistered('myCallback')`
2. Callback name matches exactly (case-sensitive)
3. Email JSON is valid
4. Check console for errors

### Arguments Not Passed Correctly

**Ensure:**
- `args` is an array in the email JSON
- Arguments are in the correct order
- Arguments are the correct type

## Additional Resources

- [Email JSON Guide](EMAIL_JSON_GUIDE.md) - Complete email format documentation
- [Email System](EMAIL_SYSTEM.md) - Email system overview
- [Examples](../examples/email-callback-example.js) - Working code examples
